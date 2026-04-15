FROM runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404

RUN apt-get update && apt-get install -y \
    libopengl0 \
    libtbb-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/lib/x86_64-linux-gnu/libOpenGL.so.0.0.0 /usr/lib/x86_64-linux-gnu/libOpenGL.so.0 && ldconfig

# Set LD_LIBRARY_PATH at OS level so pymeshlab can find libOpenGL
RUN echo '/usr/lib/x86_64-linux-gnu' >> /etc/ld.so.conf.d/opengl.conf && ldconfig
ENV LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH

COPY Hunyuan3D-2.tar.gz /workspace/
RUN tar -xzf /workspace/Hunyuan3D-2.tar.gz -C /workspace && rm /workspace/Hunyuan3D-2.tar.gz

WORKDIR /workspace/Hunyuan3D-2

RUN pip install --no-cache-dir \
    accelerate==1.13.0 \
    safetensors==0.7.0 \
    omegaconf==2.3.0 \
    einops==0.8.2 \
    trimesh==4.11.5 \
    pymeshlab==2025.7.post1 \
    pygltflib==1.16.5 \
    xatlas==0.0.11 \
    opencv-python==4.13.0.92 \
    rembg==2.0.75 \
    onnxruntime==1.24.4 \
    pymatting==1.1.15 \
    sentencepiece==0.2.1 \
    hf_transfer==0.1.9 \
    fastapi==0.135.3 \
    uvicorn==0.44.0 \
    ninja==1.13.0 \
    pybind11==3.0.3 \
    runpod

RUN pip install --no-cache-dir -e .

ENV TORCH_CUDA_ARCH_LIST="8.0;8.6;8.9;9.0"
RUN cd hy3dgen/texgen/custom_rasterizer && python3 setup.py install && cd /workspace/Hunyuan3D-2
RUN cd hy3dgen/texgen/differentiable_renderer && python3 setup.py install && cd /workspace/Hunyuan3D-2

# Pin these LAST so nothing can override them
RUN pip install --no-cache-dir --force-reinstall \
    diffusers==0.29.0 \
    transformers==4.38.2 \
    huggingface_hub==0.36.2 \
    tokenizers==0.15.2

COPY handler.py /workspace/handler.py

ENV HF_HOME=/runpod-volume/cache
ENV HUGGINGFACE_HUB_CACHE=/runpod-volume/cache/hy3dgen
ENV HF_MODULES_CACHE=/workspace/Hunyuan3D-2/hy3dgen/texgen
ENV HF_HUB_ENABLE_HF_TRANSFER=1
ENV PYTHONUNBUFFERED=1
ENV MODEL_PATH=/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2
ENV TEX_MODEL_PATH=/runpod-volume/cache/hy3dgen/tencent/Hunyuan3D-2
ENV SUBFOLDER=hunyuan3d-dit-v2-0

WORKDIR /workspace
CMD ["python3", "-u", "handler.py"]