# Serve the Mother Hen static game with nginx, running as a non-root user.
FROM nginx:1.27-alpine

# Static site assets (no build step — pure HTML/CSS/JS).
COPY index.html style.css game.js README.md memo-transcript.txt /usr/share/nginx/html/

# Non-root nginx config (pid + temp paths under /tmp, listens on 8080).
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080
USER 101:101
CMD ["nginx", "-g", "daemon off;"]
