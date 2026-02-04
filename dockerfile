# ====== Build ======
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ====== Run (Nginx) ======
FROM nginx:alpine

# Angular (CLI) normalmente gera em dist/<nome-do-projeto>/browser
# Ajuste o caminho abaixo se seu dist for diferente
COPY --from=build /app/dist/simulador-orcamento/browser /usr/share/nginx/html

# Config p/ SPA (rota do Angular funcionar ao dar F5)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
