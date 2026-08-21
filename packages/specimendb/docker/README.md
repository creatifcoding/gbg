# specimendb Postgres (Timescale + AGE)

Local catalog SoT container. Copied from `packages/tmnl/docker/docker-compose.iiot.yml` and `packages/tmnl/docker/iiot-db/`. Renamed container / database / volume so it does not collide with IIoT on 5433.

TimescaleDB + Apache AGE. Compose builds `Dockerfile.lite`. The full `Dockerfile` is the iiot-db copy. No geoint init SQL. Catalog tables are not created here — that is the Effect migrator.

The static capture page (`packages/specimendb/capture/`) does not talk to this container, RPC, or Intake.

## Start

```sh
cd packages/specimendb/docker
docker compose up -d
```

## Connection

```
postgresql://specimen:specimen_dev@localhost:5434/specimendb
```

| | IIoT (source) | specimendb |
|---|---|---|
| Container | `tmnl_iiot_db` | `specimendb_pg` |
| Database | `iiot_mock` | `specimendb` |
| User | `iiot` | `specimen` |
| Port | `5433` | `5434` |
| Volume | `iiot-db-data` | `specimendb-pg-data` |
