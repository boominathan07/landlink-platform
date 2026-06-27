import sys
import json
import time

try:
    import pdfplumber # type: ignore
except ImportError:
    pass # Provide clear instruction in the error if missing

def extract_table_data(pdf_path):
    start_time = time.time()
    
    try:
        plots = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                # Extract tables using pdfplumber's built-in table extractor
                tables = page.extract_tables()
                
                for table in tables:
                    for row in table:
                        # Clean row data (remove Nones and newlines)
                        clean_row = [str(cell).strip().replace('\n', ' ') if cell else "" for cell in row]
                        
                        # Basic heuristic: Check if first column looks like a plot number
                        # and if the row has enough columns (PlotNo, Width, Length, Area, Cent)
                        if len(clean_row) >= 4 and clean_row[0].isdigit():
                            try:
                                plot_number = clean_row[0]
                                
                                def parse_cell(val_str):
                                    if "=" in val_str:
                                        return float(val_str.split("=")[-1].strip())
                                    return float(val_str.replace(" ", ""))

                                width = parse_cell(clean_row[1])
                                length = parse_cell(clean_row[2])
                                area = parse_cell(clean_row[3])
                                cent = parse_cell(clean_row[4]) if len(clean_row) > 4 and clean_row[4] else round(area / 435.6, 2)
                                
                                plots.append({
                                    "plot_number": plot_number,
                                    "width": width,
                                    "length": length,
                                    "area": area,
                                    "cent": cent
                                })
                            except ValueError:
                                # Skip headers or malformed rows
                                continue

        processing_time = round(time.time() - start_time, 2)
        
        return {
            "success": True,
            "total_plots": len(plots),
            "plots": plots,
            "processing_time": processing_time
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    
    if 'pdfplumber' not in sys.modules:
        print(json.dumps({
            "success": False, 
            "error": "pdfplumber is not installed. Please run: pip install pdfplumber"
        }))
        sys.exit(1)

    result = extract_table_data(pdf_path)
    print(json.dumps(result))
