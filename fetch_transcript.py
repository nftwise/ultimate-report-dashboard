from youtube_transcript_api import YouTubeTranscriptApi

video_id = "ltXV7dng3Gs"

ytt = YouTubeTranscriptApi()

try:
    transcript = ytt.fetch(video_id, languages=['vi', 'en'])
    for entry in transcript.snippets:
        start = entry.start
        mins = int(start // 60)
        secs = int(start % 60)
        print(f"[{mins:02d}:{secs:02d}] {entry.text}")
except Exception as e:
    print(f"Error: {e}")
    try:
        transcript_list = ytt.list(video_id)
        print("\nAvailable transcripts:")
        for t in transcript_list:
            print(f"  - {t.language} ({t.language_code})")
    except Exception as e2:
        print(f"Cannot list transcripts: {e2}")
