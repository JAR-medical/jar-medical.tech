# J.A.R. transcription server (Ubuntu)

Runs the model behind the "Demo: transcription" course. The website sends each
recording to `https://stt.jar-medical.tech/transcribe` and gets back a
transcript split by speaker. The format is described in `corporate/README.md`,
section "Transkriptions-Server".

Here is how the pieces connect:

    Browser (jar-medical.tech) ──HTTPS──▶ Cloudflare Tunnel ──▶ this computer, 127.0.0.1:8000
                                                           server.py: WhisperX + pyannote

The computer opens no port. `cloudflared` builds an outgoing connection to
Cloudflare, which already manages the DNS for jar-medical.tech. Recordings are
deleted as soon as they are transcribed.

## What you need

- Ubuntu 22.04 or 24.04 with Python 3.10–3.12.
- An NVIDIA GPU with at least 10 GB of memory for `large-v3`, with the NVIDIA
  driver installed (`nvidia-smi` must work). With 6–8 GB, use
  `STT_COMPUTE=int8_float16` or `STT_MODEL=medium`. Without a GPU, set
  `STT_DEVICE=cpu` and `STT_MODEL=small`. Larger models on a CPU take longer
  than the website's 60-second limit.
- A free Hugging Face account. The speaker separation (pyannote) is gated:
  open https://huggingface.co/pyannote/speaker-diarization-3.1 and
  https://huggingface.co/pyannote/segmentation-3.0 and accept the conditions on
  both. Then create a *read* token under Settings → Access Tokens.
- Access to the Cloudflare account that holds jar-medical.tech.

## 1 · Install the server

```sh
sudo apt update && sudo apt install -y ffmpeg python3-venv git
sudo useradd --system --home /opt/jar-stt --create-home --shell /usr/sbin/nologin jarstt
sudo cp server.py requirements.txt /opt/jar-stt/        # from this folder
sudo -u jarstt python3 -m venv /opt/jar-stt/venv
sudo -u jarstt /opt/jar-stt/venv/bin/pip install -r /opt/jar-stt/requirements.txt
```

## 2 · Settings and token

Create `/etc/jar-stt.env`. It is readable only by root; systemd passes it to
the server.

```sh
sudo install -m 600 /dev/null /etc/jar-stt.env
sudo nano /etc/jar-stt.env
```

```ini
HF_TOKEN=hf_...your token...
STT_MODEL=large-v3
STT_DEVICE=cuda
# Optional:
# STT_COMPUTE=int8_float16
# STT_ORIGINS=https://jar-medical.tech,https://www.jar-medical.tech
# STT_PER_IP_PER_HOUR=30
```

Never commit this file or put the token in the website.

## 3 · Start it as a service

```sh
sudo cp jar-stt.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jar-stt
journalctl -u jar-stt -f          # first start downloads the models (a few GB), wait for "models ready"
curl http://127.0.0.1:8000/health # → {"ok":true,...}
```

## 4 · Cloudflare Tunnel

The simplest route is a tunnel managed in the Cloudflare dashboard:

1. Go to Cloudflare dashboard → Zero Trust → Networks → Tunnels → **Create a
   tunnel**, choose type *Cloudflared*, and name it `jar-stt`.
2. Under "Install connector", choose Debian/Ubuntu and run the commands it
   shows on this computer. The last one is
   `sudo cloudflared service install <token>`.
3. Under **Public hostname**, set the subdomain to `stt`, the domain to
   `jar-medical.tech`, the type to `HTTP` and the URL to `localhost:8000`.
   Save.
4. Test it from any computer: `curl https://stt.jar-medical.tech/health`.

Cloudflare creates the DNS record itself, and both services restart after a
reboot.

## 5 · Connect the website

In `corporate/js/config.js`, set
`TRANSCRIPTION_ENDPOINT: "https://stt.jar-medical.tech"`, then commit and push.
The demo then reads "Transcription server: configured", and **Transcribe**
sends the recording.

## Operation

- Only one recording is processed at a time. A second request gets 503, which
  the page shows as "server busy". Each IP may send 30 recordings per hour.
- Only https://jar-medical.tech may call the server from a browser (CORS).
  CORS doesn't stop scripts, which is why the size, length and rate limits
  exist. A Cloudflare WAF rate-limiting rule adds another layer.
- To update: copy the new `server.py` to `/opt/jar-stt/`, then run
  `sudo systemctl restart jar-stt`.
- To test without models (on any computer):
  `pip install fastapi python-multipart httpx && python test_server.py`.
- Our own fine-tuned model would replace the `Engine` class in `server.py`. The
  HTTP interface stays the same.
