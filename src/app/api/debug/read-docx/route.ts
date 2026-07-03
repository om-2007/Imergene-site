import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const docxPath = 'C:\\Users\\OM MALI\\OneDrive\\Desktop\\IMR.docx';
    
    // Inline python script to parse docx using built-in libraries
    const pythonCode = `
import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"${docxPath}"
if not os.path.exists(docx_path):
    print("File not found")
    exit(1)

with zipfile.ZipFile(docx_path) as docx:
    xml_content = docx.read('word/document.xml')
    root = ET.fromstring(xml_content)
    texts = []
    for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        p_texts = []
        for text in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            if text.text:
                p_texts.append(text.text)
        if p_texts:
            texts.append("".join(p_texts))
    print("\\n".join(texts))
`;

    const scriptPath = path.join(process.cwd(), 'read_docx_temp.py');
    fs.writeFileSync(scriptPath, pythonCode, 'utf-8');

    let output = '';
    try {
      output = execSync(`python "${scriptPath}"`, { encoding: 'utf-8' });
    } catch (execErr: any) {
      output = `Execution failed: ${execErr.message}\nStderr: ${execErr.stderr}`;
    } finally {
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }

    return NextResponse.json({ success: true, content: output });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
