//@ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { extractTextFromPDF, convertTextToMarkdown } from '../_lib/pdf-parser.ts';
import { processMarkdown } from '../_lib/markdown-parser.ts';
import { extractTextFromPPTX, convertTextPptToMarkdown } from '../_lib/ppt-parser.ts';
import { extractTextFromDOCX, convertTextWordToMarkdown } from '../_lib/word-parser.ts';
// import { extractTextFromImage, convertTextImageToMarkdown } from '../_lib/image-parser.ts';


// These are automatically injected
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing environment variables.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization) {
    return new Response(
      JSON.stringify({ error: 'No authorization header passed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        authorization,
      },
    },
    auth: {
      persistSession: false,
    },
  });

  const { document_id } = await req.json();

  const { data: document } = await supabase
    .from('documents_with_storage_path')
    .select()
    .eq('id', document_id)
    .single();

  if (!document?.storage_object_path) {
    return new Response(
      JSON.stringify({ error: 'Failed to find uploaded document' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { data: file } = await supabase.storage
    .from('files')
    .download(document.storage_object_path);

  if (!file) {
    return new Response(
      JSON.stringify({ error: 'Failed to download storage object' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const fileExtension = document.storage_object_path.split('.').pop();
  console.log(`File extension: ${fileExtension}`);

  let processedSections;

  if (fileExtension === 'md') {
    // If markdown, process as usual
    const fileContents = await file.text();
    processedSections = processMarkdown(fileContents).sections;
  } 
  else if (fileExtension === 'pdf') {
    // If PDF, extract text from the PDF file
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromPDF(arrayBuffer);
    const markdownText = convertTextToMarkdown(text);

    processedSections = processMarkdown(markdownText).sections;
  } 
  else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
      // Convert the file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPPTX(arrayBuffer);
      const markdownText = convertTextPptToMarkdown(text);
      processedSections = processMarkdown(markdownText).sections;

  }
  else if (fileExtension === 'docx' || fileExtension === 'doc') {
    // Convert the file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromDOCX(arrayBuffer);
    const markdownText = convertTextWordToMarkdown(text);
    processedSections = processMarkdown(markdownText).sections;

}
  // else if (fileExtension === 'jpeg' || fileExtension === 'png' || fileExtension === 'jpg') {
  //   // Convert the file to ArrayBuffer
  //   const arrayBuffer = await file.arrayBuffer();
  //   const text = await extractTextFromImage(arrayBuffer);
  //   const markdownText = convertTextImageToMarkdown(text);
  //   processedSections = processMarkdown(markdownText).sections
  // }

  else {
    return new Response(
      JSON.stringify({ error: 'Unsupported file type' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(`Processing document: ${document_id}`);
  console.log(`Processed ${processedSections.length} sections`);

  const { error, data } = await supabase.from('document_sections').insert(
    processedSections.map(({ content }) => ({
      document_id,
      content,
      
    }))
  ).select();

  if (error) {
    console.error('Error inserting document sections:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save document sections' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(`Inserted ${data.length} document sections`);

  // Call the embed function
  const embedResponse = await fetch(`${supabaseUrl}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authorization,
    },
    body: JSON.stringify({
      ids: data.map(section => section.id),
      table: 'document_sections',
      contentColumn: 'content',
      embeddingColumn: 'embedding',
    }),
  });

  if (!embedResponse.ok) {
    console.error('Error calling embed function:', await embedResponse.text());
  }

  return new Response(null, {
    status: 204,
    headers: { 'Content-Type': 'application/json' },
  });
});
