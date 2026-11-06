// Curated header images served from public/images/headers/. All files are
// 1440x480 (3:1) JPEGs with 480x160 picker thumbnails in thumbs/; email output
// must reference them by absolute URL.
export const HEADER_IMAGE_WIDTH = 1440;
export const HEADER_IMAGE_HEIGHT = 480;

export const HEADER_IMAGES = [
  { id: "mountains-through-arch", alt: "Mountains at dusk framed by an arched doorway" },
  { id: "orange-flowers-golden-hour", alt: "Orange flowers in golden evening light" },
  { id: "foothills-moonrise", alt: "Moon rising over sunlit foothills" },
  { id: "pines-at-dusk", alt: "Pine trees silhouetted against a purple dusk sky" },
  { id: "palms-and-moon-at-dusk", alt: "Tall palm trees and a full moon at dusk" },
  { id: "agave-and-mountains", alt: "Agave plant in front of the mountains under a blue sky" },
  { id: "view-to-downtown-la", alt: "Tree-covered neighborhood with the downtown Los Angeles skyline in the distance" },
  { id: "foothill-valley-view", alt: "Hillside neighborhood and green hills under a clear sky" },
  { id: "san-gabriels-alpenglow", alt: "San Gabriel Mountains glowing pink at sunset" },
  { id: "valley-lights-twilight", alt: "City lights spreading across the valley at twilight" },
  { id: "palm-row-and-mountains", alt: "Row of tall palm trees in front of the mountains" },
  { id: "pink-sunset-foothills", alt: "Foothills and treetops under a pink sunset sky" },
  { id: "canyon-waterfall", alt: "Waterfall pouring through a rocky canyon" },
  { id: "hazy-ridge-morning", alt: "Hazy morning light over mountain ridges and the valley" },
  { id: "creek-in-the-canyon", alt: "Shallow creek running between trees in a green canyon" },
].map((img) => ({
  ...img,
  src: `/images/headers/${img.id}.jpg`,
  thumb: `/images/headers/thumbs/${img.id}.jpg`,
}));

export function getHeaderImage(id) {
  return HEADER_IMAGES.find((img) => img.id === id) || null;
}
