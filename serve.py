"""Servidor local del spike.

Con hilos: el http.server por defecto es de un solo hilo y se bloquea con una sola
conexión colgada, lo que rompería las pruebas simultáneas desde varios dispositivos.

Doble pila (IPv6 + IPv4 mapeado): Chrome resuelve "localhost" a ::1 antes que a
127.0.0.1; escuchar sólo en IPv4 provoca fallos de conexión intermitentes.
"""
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        return super().server_bind()


if __name__ == '__main__':
    DualStackServer(('::', 8899), Handler).serve_forever()
