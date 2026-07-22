import time

class Cache:
    def __init__(self, ttlSeconds : int = 600) -> None:
        self.ttlSeconds : int = ttlSeconds

        self.store : dict = {}
    
    def set(self, key : tuple, data : dict) -> None:
        self.store[key] = {
            "data": data,
            "creationTime": time.monotonic()
        }

        self._freeCacheTimeout()

    def get(self, key : tuple) -> dict | None:
        self._freeCacheTimeout()

        if key not in self.store :
            return None

        return self.store[key]["data"]
    
    def _freeCacheTimeout(self) -> None:
        now : float = time.monotonic()

        expiredKeys : list = [
            key
            for key, entry in self.store.items()
            if now - entry["creationTime"] > self.ttlSeconds
        ]

        for key in expiredKeys:
            del self.store[key]