atlas {
  cloud {
    project = "myblogv4"
  }
}

env "prod" {
  url = getenv("POSTGRESQL_URL")
  migration {
    dir              = "atlas://myblogv4"
    format           = atlas
    revisions_schema = "public"
  }
}
