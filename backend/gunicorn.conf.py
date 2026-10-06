import os


bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
worker_class = "gthread"
threads = 2
timeout = 120
graceful_timeout = 30
max_requests = 1000
max_requests_jitter = 100
accesslog = "-"
errorlog = "-"
access_log_format = "%(m)s %(s)s %(L)s"
forwarded_allow_ips = "*"