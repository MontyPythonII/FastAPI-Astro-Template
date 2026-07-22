import os
import uvicorn

if __name__ == "__main__":
    port : int = 7070

    try:
        port = int(os.environ.get("SERVER_PORT", "7070"))
    except:
        pass

    uvicorn.run("app.app:app", host="0.0.0.0", port=port, reload=True)