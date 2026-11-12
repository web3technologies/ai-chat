{{- define "ai-chat.databaseUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@bouncer:5432/{{ .Values.postgres.database }}
{{- end -}}

{{- define "ai-chat.directUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@postgres:5432/{{ .Values.postgres.database }}
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
