FROM node:22-alpine
ENV TZ=Asia/Kolkata
EXPOSE 3000
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN apk update && apk add --no-cache gettext
CMD ["sh", "-c", "npm run dev"]
