from pathlib import Path
from dotenv import load_dotenv

# Load optional local settings before database/security modules read environment variables.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
