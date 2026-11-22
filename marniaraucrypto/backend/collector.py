import asyncio
import time
from database import init_db, insert_prices
from fetcher import get_prices

INTERVAL = 3600


async def collect():
    init_db()
    print("Collecteur MarniarauCrypto démarré. Collecte toutes les heures.")
    while True:
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Collecte des prix...")
        result = await get_prices()
        if result["status"] == "ok":
            insert_prices(result["data"], int(time.time()))
            print("Prix enregistrés.")
        else:
            print(f"Erreur : {result['message']}")
        await asyncio.sleep(INTERVAL)


if __name__ == "__main__":
    asyncio.run(collect())
