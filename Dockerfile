# 多色滚筒套准校核 —— 生产镜像
FROM node:20-alpine

WORKDIR /app

# 仅拷贝依赖清单以利用层缓存
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# 拷贝应用代码
COPY src ./src
COPY public ./public

# 方案 JSON 持久化目录（compose 中挂载命名卷覆盖此目录）
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
