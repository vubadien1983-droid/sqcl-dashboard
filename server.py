"""
SQCL Dashboard Entrypoint & Local Dev Server
Compatible with Vercel Serverless Functions and local execution.
"""
from api.index import handler

app = handler
application = handler

if __name__ == "__main__":
    from local_server import ThreadingHTTPServer, SQCLRequestHandler, PORT
    print(f"Starting SQCL Dashboard Server on http://0.0.0.0:{PORT} ...")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SQCLRequestHandler)
    server.serve_forever()
