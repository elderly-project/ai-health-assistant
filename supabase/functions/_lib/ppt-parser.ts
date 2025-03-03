//@ts-ignore
import JSZip from 'npm:jszip';

// Function to extract text from a PPTX buffer (directly from memory)
export async function extractTextFromPPTX(pptxBuffer: ArrayBuffer): Promise<string> {
    const zip = await JSZip.loadAsync(pptxBuffer);
    let extractedText = '';

    // Iterate through the slides in the PPTX file
    const slideFiles = Object.keys(zip.files).filter((fileName) =>
        fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
    );

    for (const slideFile of slideFiles) {
        const slideContent = await zip.files[slideFile].async('string');

        // Extract text content from the slide's XML data
        const texts = slideContent.match(/<a:t>(.*?)<\/a:t>/g) || [];
        texts.forEach((text: string) => {
            extractedText += text.replace(/<\/?a:t>/g, '') + '\n';
        });
    }

    return extractedText;
}

// Function to convert text to Markdown
export function convertTextPptToMarkdown(text: string): string {
    return text
        .replace(/(\b[A-Z][A-Z\s]+\b)/g, '## $1')  // Simple heading detection
        .replace(/\n\s*\n/g, '\n\n');  // Replace multiple new lines with Markdown paragraphs
}

