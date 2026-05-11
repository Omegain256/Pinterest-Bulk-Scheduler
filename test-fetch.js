async function test() {
    const target = "https://ballettonet.co/cropped-trench";
    console.log("Fetching HTML...");
    const htmlRes = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await htmlRes.text();
    // find a jpeg or png
    const match = html.match(/https:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
    if (!match) {
        console.log("No image found.");
        return;
    }
    const imgUrl = match[0];
    console.log("Found image:", imgUrl);
    
    console.log("Fetching image without headers (like applyTemplate)...");
    const res = await fetch(imgUrl);
    console.log("ApplyTemplate fetch status:", res.status);
    
    console.log("Fetching image with headers...");
    const res2 = await fetch(imgUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        }
    });
    console.log("Headers fetch status:", res2.status);
}
test();
