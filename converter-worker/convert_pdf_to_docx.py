import sys

from pdf2docx import Converter


def main():
    source, target = sys.argv[1:3]
    converter = Converter(source)
    try:
        if len(converter.fitz_doc) > 100:
            raise ValueError("PDF to Word supports up to 100 pages per file")
        converter.convert(target, multi_processing=False, raw_exceptions=True)
    finally:
        converter.close()


if __name__ == "__main__":
    main()
