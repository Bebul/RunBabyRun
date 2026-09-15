let cache;

export async function loadGameData() {
  if (!cache) {
    cache = Promise.all([
      fetch('/generated/mazes.json').then(checkResponse).then((response) => response.json()),
      fetch('/generated/sprites.json').then(checkResponse).then((response) => response.json()),
      fetch('/generated/zones.json').then(checkResponse).then((response) => response.json()),
      loadImage('/generated/atlas.png'),
    ]).then(([mazeData, spriteData, zoneData, atlas]) => ({
      mazes: mazeData.mazes,
      sprites: spriteData.sprites,
      zones: zoneData.zones,
      palette: spriteData.palette,
      atlas,
    }));
  }
  return cache;
}

function checkResponse(response) {
  if (!response.ok) throw new Error(`Data se nepodařilo načíst (${response.status}).`);
  return response;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Obrázek ${source} se nepodařilo načíst.`));
    image.src = source;
  });
}
