'use client';

import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Database } from '@/supabase/functions/_lib/database';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function FilesPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const [isPrescription, setIsPrescription] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: documents, refetch } = useQuery(['files'], async () => {
    const { data, error } = await supabase
      .from('documents_with_storage_path')
      .select();

    if (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to fetch documents',
      });
      throw error;
    }

    return data;
  });

  const { data: medications } = useQuery(['medications'], async () => {
    const { data, error } = await supabase
      .from('medications')
      .select('id, name')
      .order('name');

    if (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to fetch medications',
      });
      throw error;
    }

    return data;
  });

  const handleFileUpload = async (selectedFile: File) => {
    setIsUploading(true);
    try {
      // Upload the file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(
          `${crypto.randomUUID()}/${selectedFile.name}`,
          selectedFile
        );

      if (uploadError) {
        throw uploadError;
      }

      // If it's a prescription, wait for processing to complete
      if (isPrescription && uploadData && medicationName) {
        // Get the document ID
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give time for the trigger to process the file
        
        const { data: documents } = await supabase
          .from('documents_with_storage_path')
          .select('id')
          .eq('storage_object_path', uploadData.path)
          .limit(1);
        
        if (documents && documents.length > 0) {
          const documentId = documents[0].id;
          
          // Get user ID
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData?.user) {
            // Call function to link document to medication
            const { error: linkError } = await supabase.rpc(
              'link_document_to_medication',
              {
                document_id: documentId, 
                medication_name: medicationName,
                user_id: userData.user.id
              }
            );
            
            if (linkError) {
              console.error('Error linking medication:', linkError);
            }
          }
        }
      }

      toast({
        description: 'File uploaded successfully!',
      });
      
      refetch();
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        description: 'There was an error uploading the file. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl m-4 sm:m-10 flex flex-col gap-8 grow items-stretch">
      <div className="h-auto flex flex-col justify-center items-center border-b pb-8">
        <h1 className="text-2xl font-bold mb-6">Upload Documents</h1>
        <div className="w-full max-w-md p-6 border rounded-lg shadow-sm">
          <div className="mb-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                checked={isPrescription}
                onChange={(e) => setIsPrescription(e.target.checked)}
              />
              <span className="ml-2">This is a prescription</span>
            </label>
          </div>
          
          {isPrescription && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Link to Medication
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
              >
                <option value="">Select a medication (optional)</option>
                {medications?.map((med) => (
                  <option key={med.id} value={med.name}>
                    {med.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <Input
            type="file"
            name="file"
            className="cursor-pointer w-full mb-4"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={async (e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) {
                await handleFileUpload(selectedFile);
              }
            }}
          />
          
          <div className="text-sm text-gray-500 mb-4">
            Supported formats: PDF, DOC, DOCX, PNG, JPG
          </div>
          
          {isUploading && (
            <div className="text-center py-2">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
              Uploading...
            </div>
          )}
        </div>
      </div>
      
      {documents && documents.length > 0 && (
        <>
          <h2 className="text-xl font-bold">Your Documents</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-2 justify-center items-center border rounded-md p-4 sm:p-6 text-center overflow-hidden cursor-pointer hover:bg-slate-100"
                onClick={async () => {
                  if (!document.storage_object_path) {
                    toast({
                      variant: 'destructive',
                      description: 'Failed to download file, please try again.',
                    });
                    return;
                  }

                  const { data, error } = await supabase.storage
                    .from('files')
                    .createSignedUrl(document.storage_object_path, 60);

                  if (error) {
                    toast({
                      variant: 'destructive',
                      description: 'Failed to download file. Please try again.',
                    });
                    return;
                  }

                  window.location.href = data.signedUrl;
                }}
              >
                <svg
                  width="50px"
                  height="50px"
                  version="1.1"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="m82 31.199c0.10156-0.60156-0.10156-1.1992-0.60156-1.6992l-24-24c-0.39844-0.39844-1-0.5-1.5977-0.5h-0.19922-31c-3.6016 0-6.6016 3-6.6016 6.6992v76.5c0 3.6992 3 6.6992 6.6016 6.6992h50.801c3.6992 0 6.6016-3 6.6016-6.6992l-0.003906-56.699v-0.30078zm-48-7.1992h10c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2h-10c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2zm32 52h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm-8-15v-17.199l17.199 17.199z" />
                </svg>

                <div className="mt-2 font-medium text-sm truncate w-full">
                  {document.name}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(document.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      <div className="flex justify-center mt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
