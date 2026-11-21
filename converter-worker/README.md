# Isolated Office-to-PDF worker

This worker converts DOC/DOCX, XLS/XLSX, and PPT/PPTX uploads to PDF using LibreOffice when Adobe PDF Services credentials are not configured. For PDF-to-DOCX, it uses pdf2docx to rebuild editable text, tables, images, and page layout locally. The worker is separate from the Express API so document parsers run in a constrained container.

From the project root, start the worker with:

```powershell
docker compose -f converter-worker/compose.yaml up --build
```

The API uses `http://127.0.0.1:3101` by default. Override `OFFICE_CONVERTER_URL` in the server environment if the worker is on another private endpoint. Keep the worker on a trusted private network; the supplied Compose file binds its port to localhost and disables outbound container networking. Rebuild the worker after code changes so the new PDF-to-Word route is available.

The worker limits uploads to 25 MB and 100 pages, runs one conversion at a time with a 75-second timeout, runs without root privileges, and deletes its per-job temporary directory after returning the converted file. PDF-to-DOCX uses a layout reconstruction engine; complex PDFs can still need small edits in Word. Docker Desktop must be installed and running before starting the worker.
