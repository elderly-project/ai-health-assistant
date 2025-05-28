'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/supabase/functions/_lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Upload, FileText, Download, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface PatientProfile {
  id: string;
  full_name: string | null;
}

interface Document {
  id: number;
  name: string;
  created_at: string;
  storage_object_path: string | null;
  created_by: string;
}

export default function PatientFilesPage({ params }: { params: { id: string } }) {
  const supabase = createClientComponentClient<Database>();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            variant: 'destructive',
            description: 'You must be logged in to view patient files.',
          });
          return;
        }
        setCurrentUser(user.id);

        // Fetch patient profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('id', params.id)
          .single();

        if (profileError) {
          console.error('Error fetching patient profile:', profileError);
          // Create placeholder for patients without complete profiles
          setPatient({
            id: params.id,
            full_name: 'Patient (Incomplete Profile)'
          });
        } else {
          setPatient(profileData);
        }

        // Fetch documents for this patient
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents_with_storage_path')
          .select('*')
          .eq('created_by', params.id)
          .order('created_at', { ascending: false });

        if (documentsError) {
          console.error('Error fetching documents:', documentsError);
          toast({
            variant: 'destructive',
            description: 'Failed to load patient documents.',
          });
        } else {
          setDocuments(documentsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to load patient information.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, params.id]);

  const handleFileUpload = async (selectedFile: File) => {
    if (!currentUser) {
      toast({
        variant: 'destructive',
        description: 'You must be logged in to upload files.',
      });
      return;
    }

    setUploading(true);
    try {
      // Upload the file to storage
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${params.id}/${Date.now()}-${selectedFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Create document record
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          name: selectedFile.name,
          storage_object_id: uploadData.path,
          created_by: params.id, // Associate with patient
        })
        .select()
        .single();

      if (documentError) {
        throw documentError;
      }

      toast({
        description: 'File uploaded successfully!',
      });

      // Refresh documents list
      const { data: documentsData } = await supabase
        .from('documents_with_storage_path')
        .select('*')
        .eq('created_by', params.id)
        .order('created_at', { ascending: false });

      setDocuments(documentsData || []);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to upload file. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    if (!document.storage_object_path) {
      toast({
        variant: 'destructive',
        description: 'File path not found.',
      });
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .createSignedUrl(document.storage_object_path, 60);

      if (error) {
        throw error;
      }

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to download file.',
      });
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        throw error;
      }

      toast({
        description: 'Document deleted successfully.',
      });

      // Refresh documents list
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to delete document.',
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading patient files...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <Link href={`/patients/${params.id}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Patient Profile
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Medical Records</h1>
        <p className="text-gray-600">
          {patient?.full_name || 'Patient'} - Document Management
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New Document
          </CardTitle>
          <CardDescription>
            Upload medical records, test results, or other documents for this patient
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              disabled={uploading}
              className="cursor-pointer"
            />
            <p className="text-sm text-gray-500">
              Supported formats: PDF, DOC, DOCX, PNG, JPG, JPEG, TXT
            </p>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Uploading...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Patient Documents ({documents.length})
          </CardTitle>
          <CardDescription>
            All uploaded documents for this patient
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{document.name}</h3>
                      <p className="text-sm text-gray-500">
                        Uploaded on {new Date(document.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(document)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(document.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
              <p className="text-gray-500 mb-4">
                Upload the first document for this patient to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 