
async function processKMZ(){
const status=document.getElementById('status');
const kmz=document.getElementById('kmz').files[0];
const dummy=document.getElementById('dummy').files[0];

if(!kmz||!dummy){alert('Upload file dulu');return;}

status.innerText='Processing...';

const nums=new Set((await dummy.text()).match(/\\d+/g).map(Number));
const zip=await JSZip.loadAsync(await kmz.arrayBuffer());
let kml=await zip.file('doc.kml').async('string');

let xml=new DOMParser().parseFromString(kml,'text/xml');
let marks=[...xml.getElementsByTagName('Placemark')];
let removed=0;

marks.forEach(m=>{
let n=m.getElementsByTagName('name')[0];
let keep=false;
if(n){
let x=n.textContent.match(/\\d+/);
if(x && nums.has(Number(x[0]))) keep=true;
}
if(!keep){m.parentNode.removeChild(m);removed++;}
});

zip.file('doc.kml',new XMLSerializer().serializeToString(xml));
let blob=await zip.generateAsync({type:'blob'});
let a=document.createElement('a');
a.href=URL.createObjectURL(blob);
a.download='KMZ_FILTERED_RESULT.kmz';
a.click();

status.innerText='Selesai. Terhapus '+removed+' titik.';
}
