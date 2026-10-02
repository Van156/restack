SERVER_PORT ?= 3000
WEB_PORT ?= 3001
STORYBOOK_PORT ?= 6006

.PHONY: dev dev-alchemy dev-web dev-server storybook kill-ports

# Run commands with the Node version pinned in .nvmrc when nvm is available.
NVM_DIR ?= $(HOME)/.nvm
WITH_NODE = if [ -s "$(NVM_DIR)/nvm.sh" ]; then . "$(NVM_DIR)/nvm.sh" && nvm use >/dev/null; fi; node -v;

# Free a TCP port by killing any process listening on it.
define free_port
	@pids=$$(lsof -ti tcp:$(1) -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$pids" ]; then \
		echo "Freeing port $(1) (PIDs: $$pids)"; \
		kill $$pids 2>/dev/null; sleep 1; \
		kill -9 $$(lsof -ti tcp:$(1) -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true; \
	fi
endef

kill-ports:
	$(call free_port,$(SERVER_PORT))
	$(call free_port,$(WEB_PORT))

# Local dev: API server + Vite web app, no Cloudflare credentials needed.
dev: kill-ports
	@$(MAKE) --no-print-directory -j2 dev-server dev-web

# Full `pnpm dev` (server + alchemy dev for web); needs a Cloudflare alchemy profile.
dev-alchemy: kill-ports
	@$(WITH_NODE) pnpm dev

dev-web:
	$(call free_port,$(WEB_PORT))
	@$(WITH_NODE) pnpm dev:web

dev-server:
	$(call free_port,$(SERVER_PORT))
	@$(WITH_NODE) pnpm dev:server

storybook:
	$(call free_port,$(STORYBOOK_PORT))
	@$(WITH_NODE) pnpm storybook
