
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import zipfile, tempfile, shutil, os, re
import xml.etree.ElementTree as ET

app = FastAPI(title="GeoMatch KMZ")

NS = {"k":"http://www.opengis.net/kml/2.2"}

def read_dummy(file):
    text = file.decode("utf-8")
    nums = set()
    for x in re.findall(r"\d+", text):
        nums.add(int(x))
    return nums

def filter_kmz(kmz_path, dummy_numbers):
    temp = tempfile.mkdtemp()
    with zipfile.ZipFile(kmz_path,'r') as z:
        z.extractall(temp)

    kml = os.path.join(temp,"doc.kml")
    tree = ET.parse(kml)
    root = tree.getroot()

    removed = 0

    for pm in list(root.findall(".//k:Placemark",NS)):
        name = pm.find("k:name",NS)
        keep = False

        if name is not None and name.text:
            m = re.search(r"(\d+)", name.text)
            if m and int(m.group(1)) in dummy_numbers:
                keep=True

        if not keep:
            for parent in root.iter():
                if pm in list(parent):
                    parent.remove(pm)
                    removed += 1
                    break

    tree.write(kml,encoding="utf-8",xml_declaration=True)

    output="/tmp/result_filtered.kmz"

    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for folder,_,files in os.walk(temp):
            for f in files:
                path=os.path.join(folder,f)
                z.write(path,os.path.relpath(path,temp))

    shutil.rmtree(temp)

    return output, removed


@app.post("/filter")
async def filter_file(
    kmz: UploadFile = File(...),
    dummy: UploadFile = File(...)
):
    kmz_path="/tmp/input.kmz"

    with open(kmz_path,"wb") as f:
        f.write(await kmz.read())

    numbers=read_dummy(await dummy.read())

    output,removed=filter_kmz(kmz_path,numbers)

    return FileResponse(
        output,
        media_type="application/vnd.google-earth.kmz",
        filename="filtered_area.kmz"
    )


fastapi
uvicorn
python-multipart
