# tools
Инструменты для сборки SPA

# Node.js + Vite
[nodejs.org](https://nodejs.org/en/download), [fnm](https://github.com/Schniz/fnm)

```bash
sudo apt install -y unzip
curl -o- https://fnm.vercel.app/install | bash
fnm install 24

node -v
# v24.20.0
```



[vite.dev](https://vite.dev/guide/)

```bash
npm create vite@latest vite-react-app -- --template react

cd vite-react-app
npm install
npm run dev
```



# Material UI
Проверяем собираемость компонент от Google's Material Design.

[mui.com](https://mui.com/material-ui/getting-started/example-projects/), [material-ui-vite](https://github.com/mui/material-ui/tree/master/examples/material-ui-vite)

```bash
# 200+ MB
curl https://codeload.github.com/mui/material-ui/tar.gz/master --output material-ui-master.tar.gz
tar -f material-ui-master.tar.gz -xz --strip=2 material-ui-master/examples/material-ui-vite

cd material-ui-vite
npm install
npm run dev
```
