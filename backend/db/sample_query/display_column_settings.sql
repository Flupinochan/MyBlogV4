SELECT
    a.attname          AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    pg_get_expr(d.adbin, d.adrelid) AS default_value,
    col_description(a.attrelid, a.attnum) AS comment
FROM pg_catalog.pg_attribute a
LEFT JOIN pg_catalog.pg_attrdef d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = 'messages'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;
