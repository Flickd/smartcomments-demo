import fetch from 'node-fetch';

export interface CommentGenerationStatus {
    isGenerating: boolean;
    elapsedTime: number;
}

export class LLMService {
    private readonly API_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-Coder-32B-Instruct";
    private readonly API_TOKEN: string;
    private readonly TIMEOUT_MS = 60000; // 1 minute timeout
    private statusCallback: (status: CommentGenerationStatus) => void;

    constructor(apiToken: string, onStatusUpdate: (status: CommentGenerationStatus) => void) {
        this.API_TOKEN = apiToken;
        this.statusCallback = onStatusUpdate;
    }

    async generateComment(code: string): Promise<string> {
        if (!code.trim()) {
            return '';
        }

        console.log('Generating comment for code:', code);
        const startTime = Date.now();
        let timer: NodeJS.Timer | undefined;

        try {
            this.statusCallback({ isGenerating: true, elapsedTime: 0 });
            timer = setInterval(() => {
                const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                this.statusCallback({ isGenerating: true, elapsedTime });
            }, 1000);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            const prompt = `Given this Python code line:
"${code}"
Write a brief, clear inline comment explaining what this line does. Format: # comment
Keep it concise and technical. Only return the comment part.`;

            console.log('Sending request to API...');
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 50,
                        temperature: 0.3,
                        top_p: 0.9,
                        do_sample: true,
                        return_full_text: false
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error('API response not ok:', response.status, response.statusText);
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('API response:', result);

            const comment = result[0].generated_text
                .trim()
                .replace(/^#\s*/, '')
                .trim();

            console.log('Processed comment:', comment);
            return comment;
        } catch (error: any) {
            console.error('Error in generateComment:', error);
            if (error.name === 'AbortError') {
                return '(Generation timed out)';
            }
            return `(Error: ${error.message})`;
        } finally {
            if (timer) {
                clearInterval(timer);
            }
            this.statusCallback({ isGenerating: false, elapsedTime: 0 });
        }
    }
} 