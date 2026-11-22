# Rytmus Stolu — 3D rytmická hra (PWA)

3D rytmická hra ve stylu *Magic Tiles* vytvořená v Reactu, TypeScriptu a Three.js s podporou **PWA (Progressive Web App)** pro instalaci na mobil i počítač a plným offline provozem.

## Spuštění lokálně

```bash
npm install
npm run dev
```

Aplikace běží na `http://localhost:3000`.

## Nasazení na GitHub Pages (automaticky přes GitHub Actions)

Repozitář obsahuje připravený workflow `.github/workflows/deploy.yml`, který po každém `push` do větve `main` nebo `master` automaticky sestaví produkční verzi se správnou cestou repozitáře (`BASE_PATH`) a nasadí ji na GitHub Pages.

1. Na GitHubu otevřete svůj repozitář a přejděte do **Settings → Pages**.
2. V sekci **Build and deployment → Source** vyberte **GitHub Actions**.
3. Po nahrání commitu (nebo ručním spuštění v záložce **Actions**) bude hra dostupná na HTTPS adrese `https://<vase-jmeno>.github.io/<nazev-repozitare>/`.

## Instalace jako aplikace (PWA)

Po otevření nasazené HTTPS adresy (GitHub Pages):
- **Android / Chrome / Edge (mobil i PC)**: Klepněte přímo na tlačítko **Nainstalovat aplikaci** v pravém horním rohu úvodní obrazovky hry (nebo na ikonu instalace v adresním řádku prohlížeče).
- **iOS (Safari)**: Klepněte na **Nainstalovat na iOS** nebo na ikonu **Sdílet → Přidat na plochu**.

Po instalaci hra běží v režimu samostatné aplikace (`standalone`) a funguje i bez připojení k internetu.
