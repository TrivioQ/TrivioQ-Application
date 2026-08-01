'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

export function UploadJobForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    processType: 'question-extraction',
    topic: '',
    categorySlugs: '',
    pagesFrom: '',
    pagesTo: '',
    extractionSpecialInstruction: '',
    enhancementSpecialInstruction: '',
    scoutProvider: '',
    extractionProvider: '',
    enhancementProvider: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('pdf', file);
      
      Object.entries(formData).forEach(([key, value]) => {
        if (value) {
          if (key === 'categorySlugs') {
            const slugs = value.split(',').map(s => s.trim()).filter(Boolean);
            data.append(key, JSON.stringify(slugs));
          } else {
            data.append(key, value);
          }
        }
      });

      const res = await fetch('/api/v1/admin/ingestion/jobs', {
        method: 'POST',
        body: data,
      });

      if (!res.ok) {
        throw new Error('Failed to create job');
      }

      toast.success('Job created successfully');
      router.push('/ingestion');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error('Error creating job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>PDF File *</Label>
            <Input 
              type="file" 
              accept=".pdf" 
              onChange={e => setFile(e.target.files?.[0] || null)} 
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Process Type</Label>
              <Select value={formData.processType} onValueChange={(v) => v && handleSelect('processType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question-extraction">Question Extraction</SelectItem>
                  <SelectItem value="quiz-generation">Quiz Generation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input 
                name="topic" 
                value={formData.topic} 
                onChange={handleChange} 
                placeholder="e.g. World History" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category Slugs (comma separated)</Label>
            <Input 
              name="categorySlugs" 
              value={formData.categorySlugs} 
              onChange={handleChange} 
              placeholder="e.g. history, geography" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Page Range (From)</Label>
              <Input 
                name="pagesFrom" 
                type="number" 
                value={formData.pagesFrom} 
                onChange={handleChange} 
                placeholder="e.g. 1" 
              />
            </div>
            <div className="space-y-2">
              <Label>Page Range (To)</Label>
              <Input 
                name="pagesTo" 
                type="number" 
                value={formData.pagesTo} 
                onChange={handleChange} 
                placeholder="e.g. 50" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Extraction Special Instruction</Label>
            <Textarea 
              name="extractionSpecialInstruction" 
              value={formData.extractionSpecialInstruction} 
              onChange={handleChange} 
              placeholder="Instructions injected into the extraction prompt..." 
            />
          </div>

          <div className="space-y-2">
            <Label>Enhancement Special Instruction</Label>
            <Textarea 
              name="enhancementSpecialInstruction" 
              value={formData.enhancementSpecialInstruction} 
              onChange={handleChange} 
              placeholder="Instructions injected into the enhancement prompt..." 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Scout Provider</Label>
              <Input 
                name="scoutProvider" 
                value={formData.scoutProvider} 
                onChange={handleChange} 
                placeholder="e.g. google" 
              />
            </div>
            <div className="space-y-2">
              <Label>Extraction Provider</Label>
              <Input 
                name="extractionProvider" 
                value={formData.extractionProvider} 
                onChange={handleChange} 
                placeholder="e.g. openai" 
              />
            </div>
            <div className="space-y-2">
              <Label>Enhancement Provider</Label>
              <Input 
                name="enhancementProvider" 
                value={formData.enhancementProvider} 
                onChange={handleChange} 
                placeholder="e.g. anthropic" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={loading || !file}>
          {loading ? 'Uploading...' : 'Start Job'}
        </Button>
      </div>
    </form>
  );
}
