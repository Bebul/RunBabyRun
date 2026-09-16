const assetBase = import.meta.env?.BASE_URL ?? '/';

let cache;

export async function loadGameData() {
  if (!cache) {
    cache = Promise.all([
      fetch(`${assetBase}generated/mazes.json`).then(checkResponse).then((response) => response.json()),
      fetch(`${assetBase}generated/sprites.json`).then(checkResponse).then((response) => response.json()),
      fetch(`${assetBase}generated/zones.json`).then(checkResponse).then((response) => response.json()),
      loadImage(`${assetBase}generated/atlas.png`),
    ]).then(([mazeData, spriteData, zoneData, atlas]) => ({
      mazes: mazeData.mazes,
      sprites: spriteData.sprites,
      zones: zoneData.zones,
      palette: spriteData.palette,
      atlas,
      wreckAtlas: createWreckAtlas(atlas, spriteData.palette[7]),
    }));
  }
  return cache;
}

function createWreckAtlas(atlas, gray) {
  const canvas = document.createElement('canvas');
  canvas.width = atlas.width;
  canvas.height = atlas.height;
  const context = canvas.getContext('2d');
  context.drawImage(atlas, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    // DOS putobdel2/invert*2 replace nonzero colors with palette index 7.
    // Keep black pixels and alpha intact to preserve the original silhouette.
    if (image.data[i] || image.data[i + 1] || image.data[i + 2]) {
      image.data[i] = gray[0];
      image.data[i + 1] = gray[1];
      image.data[i + 2] = gray[2];
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
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
