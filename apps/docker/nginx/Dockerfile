FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY ./apps/docker/nginx/nginx.dev.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]