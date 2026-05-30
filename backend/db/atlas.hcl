// HCL Settings: https://atlasgo.io/atlas-schema/projects
// CLI: https://atlasgo.io/cli-reference
// Free function: https://atlasgo.io/features
atlas {
  cloud {
    org = "metalmental"
  }
}

env "prod" {
  url = getenv("POSTGRESQL_URL")
  dev = "docker://postgres/16/dev"
  schema {
    src = "file://schema"
    repo {
      name = "myblogv4"
    }
  }
  lint {
    review = ALWAYS
  }
  data {
    mode     = SYNC
    max_rows = 1000
  }
}
