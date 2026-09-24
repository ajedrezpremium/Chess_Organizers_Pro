#!/usr/bin/env python3
"""
extract_contacts.py — Extracción automática de contactos públicos
de federaciones, clubes y árbitros de ajedrez.

Fuentes: FIDE, Wikipedia, Chess-Results, Info64
Salida: directorio_federaciones.csv

Uso:
  python extract_contacts.py
  python extract_contacts.py --country Spain
  python extract_contacts.py --max-contacts 200
"""

import argparse
import csv
import json
import logging
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

# ──── CONFIGURACIÓN ──────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent
CSV_PATH = OUTPUT_DIR / "directorio_federaciones.csv"
SOURCES_PATH = OUTPUT_DIR / "sources_used.json"
LOG_PATH = OUTPUT_DIR / "extraction_log.txt"
REQUEST_DELAY = 1.5
MAX_RETRIES = 3
USER_AGENT = "ChessOrganizersPro-Marketing/1.0 (chessorganizerspro@gmail.com)"

CSV_FIELDS = [
    "organization", "contact_name", "role", "email", "phone",
    "website", "source", "source_url", "country", "region",
    "type", "notes", "status",
]

COUNTRY_MAP = {
    "spain": "España", "espana": "España", "germany": "Alemania",
    "france": "Francia", "portugal": "Portugal", "italy": "Italia",
    "argentina": "Argentina", "mexico": "México", "colombia": "Colombia",
    "chile": "Chile", "peru": "Perú", "brazil": "Brasil",
    "usa": "Estados Unidos", "uk": "Reino Unido", "russia": "Rusia",
    "china": "China", "india": "India", "turkey": "Turquía",
    "sweden": "Suecia", "norway": "Noruega", "finland": "Finlandia",
    "denmark": "Dinamarca", "austria": "Austria", "switzerland": "Suiza",
    "belgium": "Bélgica", "serbia": "Serbia", "croatia": "Croacia",
    "greece": "Grecia", "poland": "Polonia", "hungary": "Hungría",
    "netherlands": "Países Bajos", "ukraine": "Ucrania",
    "romania": "Rumanía", "bulgaria": "Bulgaria", "slovakia": "Eslovaquia",
    "germany": "Alemania", "france": "Francia", "japan": "Japón",
    "south korea": "Corea del Sur", "indonesia": "Indonesia",
    "philippines": "Filipinas", "thailand": "Tailandia",
    "egypt": "Egipto", "morocco": "Marruecos", "south africa": "Sudáfrica",
    "kenya": "Kenia", "nigeria": "Nigeria", "ghana": "Ghana",
    "argentina": "Argentina", "chile": "Chile", "uruguay": "Uruguay",
    "paraguay": "Paraguay", "venezuela": "Venezuela",
    "ecuador": "Ecuador", "peru": "Perú", "bolivia": "Bolivia",
    "costa rica": "Costa Rica", "panama": "Panamá",
    "dominican republic": "República Dominicana", "cuba": "Cuba",
    "puerto rico": "Puerto Rico",
}

# ──── LOGGING ────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("extract")

# ──── UTILIDADES ─────────────────────────────────────────────────────

def fetch(url: str, retries: int = MAX_RETRIES) -> Optional[str]:
    """Descarga URL y devuelve texto HTML (None si falla)."""
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY)
            return resp.text
        except Exception as e:
            logger.warning(f"[{attempt}/{retries}] Error {url}: {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    logger.error(f"No se pudo obtener: {url}")
    return None


def extract_emails(text: str) -> set:
    """Extrae emails de un texto."""
    return set(re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', text))


def normalize_country(raw: str) -> str:
    key = raw.strip().lower()
    return COUNTRY_MAP.get(key, raw.strip())


def clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


# ──── FONTE: FIDE ────────────────────────────────────────────────────

def extract_fide(max_contacts: int) -> list:
    """Lista de federaciones desde FIDE."""
    contacts = []
    logger.info("📌 Extrayendo de FIDE...")
    html = fetch("https://www.fide.com/federations/")
    if not html:
        return contacts

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = clean_text(a.get_text())
        href = a["href"]
        if len(text) < 3 or len(text) > 200:
            continue
        emails = extract_emails(text + " " + href)
        country = normalize_country(text.split()[-1]) if text else ""
        contacts.append({
            "organization": text, "contact_name": "", "role": "Federación Nacional",
            "email": emails.pop() if emails else "", "phone": "",
            "website": urljoin("https://www.fide.com", href), "source": "FIDE",
            "source_url": "https://www.fide.com/federations/", "country": country,
            "region": "", "type": "federation", "notes": "Listado oficial FIDE",
            "status": "No contactado",
        })
        if len(contacts) >= max_contacts:
            break
    logger.info(f"  → {len(contacts)} de FIDE")
    return contacts


# ──── FONTE: WIKIPEDIA ───────────────────────────────────────────────

def extract_wikipedia(max_contacts: int) -> list:
    """Federaciones desde Wikipedia."""
    contacts = []
    logger.info("📖 Extrayendo de Wikipedia...")
    html = fetch("https://en.wikipedia.org/wiki/List_of_national_chess_federations")
    if not html:
        return contacts
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = clean_text(a.get_text())
        if len(text) < 3 or len(text) > 200:
            continue
        emails = extract_emails(text + " " + a["href"])
        country = normalize_country(text)
        contacts.append({
            "organization": text, "contact_name": "", "role": "Federación Nacional",
            "email": emails.pop() if emails else "", "phone": "",
            "website": "", "source": "Wikipedia",
            "source_url": "https://en.wikipedia.org/wiki/List_of_national_chess_federations",
            "country": country, "region": "", "type": "federation",
            "notes": "Wikipedia", "status": "No contactado",
        })
        if len(contacts) >= max_contacts:
            break
    logger.info(f"  → {len(contacts)} de Wikipedia")
    return contacts


# ──── FONTE: CHESS-RESULTS ───────────────────────────────────────────

def extract_chessresults(max_contacts: int) -> list:
    """Torneos recientes de Chess-Results (organizadores por país)."""
    contacts = []
    logger.info("♟️ Extrayendo de Chess-Results...")
    html = fetch("https://chess-results.com/tournamenten.aspx?lan=1")
    if not html:
        return contacts
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = clean_text(a.get_text())
        href = a["href"]
        if len(text) < 3 or len(text) > 200:
            continue
        emails = extract_emails(text + " " + href)
        if emails or "organizer" in text.lower() or "arbiter" in text.lower():
            contacts.append({
                "organization": text, "contact_name": "",
                "role": "Organizador/Árbitro", "email": emails.pop() if emails else "",
                "phone": "", "website": "", "source": "Chess-Results",
                "source_url": f"https://chess-results.com/{href}",
                "country": "", "region": "", "type": "tournament_organizer",
                "notes": "Torneo reciente", "status": "No contactado",
            })
        if len(contacts) >= max_contacts:
            break
    logger.info(f"  → {len(contacts)} de Chess-Results")
    return contacts


# ──── FONTE: INFO64 ──────────────────────────────────────────────────

def extract_info64(max_contacts: int) -> list:
    """Directorio de federaciones y clubes desde Info64."""
    contacts = []
    logger.info("🏢 Extrayendo de Info64...")
    html = fetch("https://www.info64.com/deportes/ajedrez/federaciones.aspx")
    if not html:
        return contacts
    soup = BeautifulSoup(html, "html.parser")
    for div in soup.find_all(["div", "p", "span"]):
        text = clean_text(div.get_text())
        if len(text) < 5:
            continue
        emails = extract_emails(text)
        if len(text) > 10 and emails:
            contacts.append({
                "organization": text, "contact_name": "",
                "role": "Federación/Club", "email": emails.pop(), "phone": "",
                "website": "", "source": "Info64",
                "source_url": "https://www.info64.com/deportes/ajedrez/federaciones.aspx",
                "country": "", "region": "", "type": "federation_or_club",
                "notes": "Info64 directorio", "status": "No contactado",
            })
        if len(contacts) >= max_contacts:
            break
    logger.info(f"  → {len(contacts)} de Info64")
    return contacts


# ──── FONTE BONUS: PÁGINAS DE FEDERACIONES ESPECÍFICAS ───────────────

def extract_specific_federations(max_contacts: int) -> list:
    """Contactos de federaciones conocidas."""
    contacts = []
    logger.info("🎯 Extrayendo federaciones específicas...")
    urls = [
        ("Real Federación Española de Ajedrez", "https://www.rfede.com", "España"),
        ("Federación Mexicana de Ajedrez", "https://www.chenaute.com", "México"),
        ("Confederación Argentina de Ajedrez", "https://www.caajedrez.org", "Argentina"),
        ("Federación Colombiana de Ajedrez", "https://www.fca.org.co", "Colombia"),
        ("Federación Chilena de Ajedrez", "https://www.fidechile.cl", "Chile"),
    ]
    for name, url, country in urls:
        html = fetch(url)
        if not html:
            contacts.append({
                "organization": name, "contact_name": "", "role": "Federación Nacional",
                "email": "", "phone": "", "website": url, "source": "Directo",
                "source_url": url, "country": country, "region": "",
                "type": "federation", "notes": "Contacto directo web",
                "status": "No contactado",
            })
            continue
        emails = extract_emails(html)
        soup = BeautifulSoup(html, "html.parser")
        contact_name = clean_text(soup.find("title").get_text()) if soup.find("title") else name
        contacts.append({
            "organization": name, "contact_name": contact_name, "role": "Federación Nacional",
            "email": emails.pop() if emails else "", "phone": "",
            "website": url, "source": "Directo", "source_url": url,
            "country": country, "region": "", "type": "federation",
            "notes": "Federación específica", "status": "No contactado",
        })
        if len(contacts) >= max_contacts:
            break
    logger.info(f"  → {len(contacts)} federaciones específicas")
    return contacts


# ──── ORQUESTACIÓN ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Extracción automática de contactos de ajedrez")
    parser.add_argument("--country", default=None, help="Filtrar por país")
    parser.add_argument("--max-contacts", type=int, default=200, help="Máximo de contactos")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("INICIO EXTRACCIÓN DE CONTACTOS — Chess Organizers Pro")
    logger.info(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    logger.info(f"País filtro: {args.country or 'Todos'}")
    logger.info(f"Máx. contactos: {args.max_contacts}")
    logger.info("=" * 60)

    all_contacts = []
    sources_status = {}

    # Extraer de cada fuente
    sources = [
        ("FIDE", extract_fide),
        ("Wikipedia", extract_wikipedia),
        ("Chess-Results", extract_chessresults),
        ("Info64", extract_info64),
        ("Específicas", extract_specific_federations),
    ]

    for name, func in sources:
        try:
            result = func(args.max_contacts)
            all_contacts.extend(result)
            sources_status[name] = {"status": "OK", "count": len(result)}
        except Exception as e:
            logger.error(f"Error en {name}: {e}")
            sources_status[name] = {"status": "ERROR", "error": str(e)}

    # Deduplicar por email
    seen = set()
    unique_contacts = []
    for c in all_contacts:
        key = c["email"].lower() if c["email"] else c["organization"].lower()
        if key not in seen:
            seen.add(key)
            unique_contacts.append(c)

    # Filtrar por país si se especifica
    if args.country:
        unique_contacts = [c for c in unique_contacts
                           if args.country.lower() in c["country"].lower()]

    # Ordenar por país
    unique_contacts.sort(key=lambda x: (x["country"], x["organization"]))

    # Escribir CSV
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(unique_contacts)

    # Guardar estado de fuentes
    sources_status["total_contacts"] = len(unique_contacts)
    sources_status["timestamp"] = datetime.now().isoformat()
    with open(SOURCES_PATH, "w", encoding="utf-8") as f:
        json.dump(sources_status, f, indent=2, ensure_ascii=False)

    logger.info("=" * 60)
    logger.info(f"✅ EXTRACCIÓN COMPLETADA: {len(unique_contacts)} contactos únicos")
    logger.info(f"📁 Archivo: {CSV_PATH}")
    logger.info(f"📁 Fuentes: {SOURCES_PATH}")
    logger.info(f"