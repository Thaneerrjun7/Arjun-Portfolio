from PyPDF2 import PdfReader
import sys
import os

reader = PdfReader(r'C:\Users\Arjun Shanker\Downloads\Portfolio\Arjun FINAL-compressed.pdf')
output_path = r'C:\Users\Arjun Shanker\Downloads\Portfolio\resume_text.txt'

with open(output_path, 'w', encoding='utf-8') as f:
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            f.write(f"--- PAGE {i+1} ---\n")
            f.write(text)
            f.write("\n\n")

print(f"Extracted {len(reader.pages)} pages to {output_path}")
