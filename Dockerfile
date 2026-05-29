FROM golang:1.26.3-bookworm AS builder

WORKDIR /usr/src/app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /go/bin/app ./cmd/main.go

FROM debian:bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg && \
    apt-get clean autoclean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /go/bin/app /go/bin/app

RUN groupadd -r saturn && useradd -r -g saturn -s /sbin/nologin saturn && \
    chown -R saturn:saturn /usr/src/app

EXPOSE 8080

USER saturn

CMD ["/go/bin/app"]
