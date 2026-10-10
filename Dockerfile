# Web app for Azure Container Apps (or any container host): the React build served by nginx.
# nginx also forwards /api to the pricing API, so the browser talks to one address and needs no CORS.
# API_URL is the API's address as seen from this container (in Azure: http://<api app name>).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# The nginx image fills ${API_URL} into this template at start-up.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
ENV API_URL=http://localhost:8000
EXPOSE 80
