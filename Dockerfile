FROM golang:1.21 AS builder

WORKDIR /usr/src/app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o /go/bin/app ./cmd

FROM golang:1.21

WORKDIR /usr/src/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates ffmpeg && \
    apt-get clean autoclean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /go/bin/app /go/bin/app

COPY .env .

EXPOSE 8080

CMD ["/go/bin/app"]
