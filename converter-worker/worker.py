import json
import os
import subprocess
import sys
import tempfile
import threading
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024
MAX_OUTPUT_BYTES = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
conversion_slot = threading.BoundedSemaphore(1)


class ConverterHandler(BaseHTTPRequestHandler):
    server_version = "PDFProConverter/1.0"

    def log_message(self, format_string, *args):
        # Avoid logging uploaded filenames or document contents.
        super().log_message(format_string, *args)

    def send_json(self, status, message):
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, "Route not found")
            return
        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path not in {"/convert-to-pdf", "/convert-pdf-to-docx"}:
            self.send_json(404, "Route not found")
            return
        if not conversion_slot.acquire(blocking=False):
            self.send_json(429, "The converter is busy. Try again shortly.")
            return
        try:
            if self.path == "/convert-to-pdf":
                self.convert_upload()
            else:
                self.convert_pdf_to_docx()
        finally:
            conversion_slot.release()

    def convert_upload(self):
        content_length = self.headers.get("Content-Length")
        content_type = self.headers.get("Content-Type", "")
        try:
            size = int(content_length or "0")
        except ValueError:
            self.send_json(400, "Invalid request size")
            return
        if size <= 0 or size > MAX_REQUEST_BYTES:
            self.send_json(413, "Upload a file smaller than 25 MB")
            return
        if not content_type.lower().startswith("multipart/form-data;"):
            self.send_json(415, "Upload one Office file")
            return

        request_body = self.rfile.read(size)
        envelope = (
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii")
            + request_body
        )
        message = BytesParser(policy=policy.default).parsebytes(envelope)
        uploads = [
            part for part in message.iter_parts()
            if part.get_param("name", header="content-disposition") == "file"
        ] if message.is_multipart() else []
        if len(uploads) != 1:
            self.send_json(400, "Upload exactly one Office file")
            return

        upload = uploads[0]
        filename = (upload.get_filename() or "").replace("\\", "/").rsplit("/", 1)[-1]
        extension = Path(filename).suffix.lower()
        payload = upload.get_payload(decode=True) or b""
        if extension not in ALLOWED_EXTENSIONS:
            self.send_json(415, "Supported formats: DOC, DOCX, XLS, XLSX, PPT, PPTX")
            return
        if not payload or len(payload) > MAX_FILE_BYTES:
            self.send_json(413, "Upload a non-empty file smaller than 25 MB")
            return

        with tempfile.TemporaryDirectory(prefix="pdfpro-") as temp_name:
            work = Path(temp_name)
            input_dir = work / "input"
            output_dir = work / "output"
            profile_dir = work / "profile"
            input_dir.mkdir()
            output_dir.mkdir()
            profile_dir.mkdir()
            source = input_dir / f"upload{extension}"
            source.write_bytes(payload)
            command = [
                "/usr/bin/soffice",
                "--headless",
                "--nologo",
                "--nodefault",
                "--nofirststartwizard",
                "--nolockcheck",
                f"-env:UserInstallation={profile_dir.as_uri()}",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(source),
            ]
            safe_env = {
                "HOME": str(work),
                "TMPDIR": str(work),
                "PATH": "/usr/bin:/bin",
                "LANG": "C.UTF-8",
                "LC_ALL": "C.UTF-8",
                "SAL_USE_VCLPLUGIN": "svp",
            }
            try:
                completed = subprocess.run(
                    command,
                    cwd=str(work),
                    env=safe_env,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=75,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                self.send_json(504, "Conversion took too long. Try a smaller document.")
                return

            result = output_dir / "upload.pdf"
            if completed.returncode != 0 or not result.is_file():
                self.send_json(422, "The Office file could not be converted")
                return
            output_size = result.stat().st_size
            if output_size <= 0 or output_size > MAX_OUTPUT_BYTES:
                self.send_json(413, "The converted PDF is empty or exceeds 100 MB")
                return
            pdf_bytes = result.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf_bytes)))
        self.send_header("Content-Disposition", 'attachment; filename="PDFPro.pdf"')
        self.end_headers()
        self.wfile.write(pdf_bytes)

    def convert_pdf_to_docx(self):
        content_length = self.headers.get("Content-Length")
        content_type = self.headers.get("Content-Type", "")
        try:
            size = int(content_length or "0")
        except ValueError:
            self.send_json(400, "Invalid request size")
            return
        if size <= 0 or size > MAX_REQUEST_BYTES:
            self.send_json(413, "Upload a PDF smaller than 25 MB")
            return
        if not content_type.lower().startswith("multipart/form-data;"):
            self.send_json(415, "Upload one PDF file")
            return

        request_body = self.rfile.read(size)
        envelope = (
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii")
            + request_body
        )
        message = BytesParser(policy=policy.default).parsebytes(envelope)
        uploads = [
            part for part in message.iter_parts()
            if part.get_param("name", header="content-disposition") == "file"
        ] if message.is_multipart() else []
        if len(uploads) != 1:
            self.send_json(400, "Upload exactly one PDF file")
            return

        upload = uploads[0]
        filename = (upload.get_filename() or "").replace("\\", "/").rsplit("/", 1)[-1]
        extension = Path(filename).suffix.lower()
        payload = upload.get_payload(decode=True) or b""
        if extension != ".pdf" or not payload.startswith(b"%PDF-"):
            self.send_json(415, "Upload a valid PDF file")
            return
        if len(payload) > MAX_FILE_BYTES:
            self.send_json(413, "Upload a PDF smaller than 25 MB")
            return

        with tempfile.TemporaryDirectory(prefix="pdfpro-pdf-to-docx-") as temp_name:
            work = Path(temp_name)
            input_dir = work / "input"
            output_dir = work / "output"
            input_dir.mkdir()
            output_dir.mkdir()
            source = input_dir / "upload.pdf"
            source.write_bytes(payload)
            command = [sys.executable, "/app/convert_pdf_to_docx.py", str(source), str(output_dir / "upload.docx")]
            safe_env = {
                "HOME": str(work),
                "TMPDIR": str(work),
                "PATH": "/usr/bin:/bin",
                "LANG": "C.UTF-8",
                "LC_ALL": "C.UTF-8",
            }
            try:
                completed = subprocess.run(
                    command,
                    cwd=str(work),
                    env=safe_env,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=75,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                self.send_json(504, "PDF to Word conversion took too long. Try a smaller PDF.")
                return

            result = output_dir / "upload.docx"
            if completed.returncode != 0 or not result.is_file():
                self.send_json(422, "The PDF could not be converted to Word")
                return
            output_size = result.stat().st_size
            if output_size <= 0 or output_size > MAX_OUTPUT_BYTES:
                self.send_json(413, "The converted Word file is empty or exceeds 100 MB")
                return
            docx_bytes = result.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.send_header("Content-Length", str(len(docx_bytes)))
        self.send_header("Content-Disposition", 'attachment; filename="PDFPro.docx"')
        self.end_headers()
        self.wfile.write(docx_bytes)


class SingleJobServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 4


if __name__ == "__main__":
    server = SingleJobServer(("0.0.0.0", 3101), ConverterHandler)
    server.serve_forever()
