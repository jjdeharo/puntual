const API_URL = "https://api.github.com/repos/jjdeharo/puntual/releases/latest";
const RELEASE_PAGE = "https://github.com/jjdeharo/puntual/releases/latest";

const latestVersion = document.querySelector("#latest-version");
const releaseName = document.querySelector("#release-name");

const links = {
  linuxDeb: document.querySelector("#linux-deb-link"),
  linuxAppImage: document.querySelector("#linux-appimage-link"),
  windowsExe: document.querySelector("#windows-exe-link"),
  windowsZip: document.querySelector("#windows-zip-link"),
  macosZip: document.querySelector("#macos-zip-link"),
};

const fallbackText = {
  version: "Disponible en GitHub Releases",
  release: "Última release en GitHub",
};

function setFallback() {
  latestVersion.textContent = fallbackText.version;
  releaseName.textContent = fallbackText.release;
}

function setLink(element, asset) {
  element.href = asset?.browser_download_url || RELEASE_PAGE;
  element.target = "_blank";
  element.rel = "noreferrer";
}

function pickAsset(assets, predicate) {
  return assets.find(predicate) || null;
}

async function hydrateDownloads() {
  setFallback();

  Object.values(links).forEach((element) => {
    element.href = RELEASE_PAGE;
    element.target = "_blank";
    element.rel = "noreferrer";
  });

  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];

    latestVersion.textContent = release.tag_name || fallbackText.version;
    releaseName.textContent = release.name || release.tag_name || fallbackText.release;

    setLink(links.linuxDeb, pickAsset(assets, (asset) => asset.name.endsWith(".deb")));
    setLink(links.linuxAppImage, pickAsset(assets, (asset) => asset.name.endsWith(".AppImage")));
    setLink(links.windowsExe, pickAsset(assets, (asset) => asset.name.endsWith(".exe")));
    setLink(
      links.windowsZip,
      pickAsset(assets, (asset) => asset.name.toLowerCase().includes("win") && asset.name.endsWith(".zip")),
    );
    setLink(
      links.macosZip,
      pickAsset(assets, (asset) => asset.name.toLowerCase().includes("mac") && asset.name.endsWith(".zip")),
    );
  } catch (error) {
    console.error("No se pudo cargar la última release de Puntual.", error);
  }
}

hydrateDownloads();
