async function test() {
    const imgUrl = "https://ballettonet.co/wp-content/uploads/2026/04/cropped-Screenshot-2026-04-02-at-7.02.34-PM-1-150x121.png";
    const res = await fetch(imgUrl);
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    console.log("Status:", res.status);
    console.log("Buffer length:", buf.length);
    console.log("First 20 bytes:", buf.slice(0, 20).toString());
}
test();
