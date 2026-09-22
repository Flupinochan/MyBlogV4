// HCL Settings: https://atlasgo.io/atlas-schema/projects
// CLI: https://atlasgo.io/cli-reference
// Free function: https://atlasgo.io/features
data "external_schema" "sqlalchemy" {
  program = [
    "uv", "run",
    "--directory", ".",
    "python3", "load_schema.py",
  ]
}

env "prod" {
  url = getenv("ATLAS_DB_URL")
  dev = "docker://postgres/16/dev"
  schema {
    src = data.external_schema.sqlalchemy.url
  }
  data {
    mode     = SYNC
    max_rows = 1000
  }
}
