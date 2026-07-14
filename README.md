# smartPDF Local Studio

This project is a local web app for browsing a large transformation catalog, uploading a file, converting it locally, and downloading the transformed output.

## Run it

```bash
/Users/musammataktar/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 server.py
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## What it supports now

- PDF text extraction routes like `PDF -> TXT`, `PDF -> HTML`, `PDF -> DOCX`
- Document routes such as `DOCX <-> TXT`, `DOCX <-> HTML`, `DOCX <-> ODT`, `DOCX <-> RTF`, `DOCX -> PDF`, `MD <-> HTML`, `MD -> PDF`, `HTML -> DOCX`, `HTML -> PDF`
- Spreadsheet and data routes such as `XLSX <-> CSV`, `XLSX -> PDF`, `XLSX -> HTML`, `CSV <-> TSV`, `CSV <-> JSON`, `JSON <-> XML`, `XML <-> CSV`
- Presentation outline exports like `PPTX -> HTML`, `PPTX -> PDF`, and `HTML -> PPTX`
- Raster image routes like `PNG/JPG/WEBP/GIF/BMP/TIFF/ICO/AVIF` conversions plus `Image -> PDF`, `Image -> DOCX`, and `Image -> HTML`
- Email and structured text routes like `EML -> HTML`, `EML -> PDF`, `HTML -> EML`, `ICS -> CSV`, `ICS -> JSON`, `GPX -> GeoJSON`, `GPX -> KML`, `KML -> GeoJSON`

## Notes

- The full catalog from your conversion table is searchable in the UI.
- Some routes are intentionally labeled as needing extra engines. Those usually require OCR, FFmpeg, vector/CAD converters, Office renderers, or model-backed AI services.
- A few exports are content-first rather than layout-perfect, especially `PDF -> DOCX`, `DOCX -> PDF`, and `PPTX -> PDF`.
