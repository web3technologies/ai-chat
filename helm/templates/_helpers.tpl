{{- define "ai-chat.databaseUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@bouncer:5432/{{ .Values.postgres.database }}
{{- end -}}

{{- define "ai-chat.directUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@postgres:5432/{{ .Values.postgres.database }}
{{- end -}}

{{- define "ai-chat.readUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@postgres-read:5432/{{ .Values.postgres.database }}
{{- end -}}

{{- define "ai-chat.redisUrl" -}}
redis://redis:6379
{{- end -}}

{{- define "ai-chat.waitForBouncer" -}}
- name: wait-for-bouncer
  image: {{ .Values.pgbouncer.image }}
  command: ["sh", "-c"]
  args:
    - |
      until pg_isready -h bouncer -p 5432; do
        echo "waiting for pgbouncer"
        sleep 2
      done
{{- end -}}

{{- define "ai-chat.waitForReplica" -}}
- name: wait-for-replica
  image: {{ .Values.postgres.image }}
  command: ["sh", "-c"]
  args:
    - |
      until pg_isready -h postgres-read -p 5432; do
        echo "waiting for postgres-read"
        sleep 2
      done
{{- end -}}

{{- define "ai-chat.waitForRedis" -}}
- name: wait-for-redis
  image: {{ .Values.redis.image }}
  command: ["sh", "-c"]
  args:
    - |
      until redis-cli -h redis ping | grep -q PONG; do
        echo "waiting for redis"
        sleep 2
      done
{{- end -}}

{{- define "ai-chat.waitForSchema" -}}
- name: wait-for-schema
  image: {{ .Values.image }}
  imagePullPolicy: {{ .Values.imagePullPolicy }}
  workingDir: /app
  command: ["sh", "-c"]
  args:
    - |
      until ./node_modules/.bin/prisma migrate status; do
        echo "waiting for migrations"
        sleep 2
      done
  env:
    - name: HOME
      value: /tmp
    - name: DATABASE_URL
      value: {{ include "ai-chat.directUrl" . | quote }}
{{- end -}}
