import type { Card, QA, TrackSpec } from "../types";

type T = 1 | 2 | 3 | 4 | 5;
const c = (group: string, subject: string, tier: T, says: string[], use?: string, not?: string[], like?: string[]): Card => ({
  group, subject, tier, says, ...(use ? { use } : {}), ...(not ? { not } : {}), ...(like ? { like } : {}),
});
const q = (tier: T, qq: string, right: string, wrong: [string, string, string], why: string, code?: string, topic?: string): QA => ({
  q: qq, right, wrong, tier, why, ...(code ? { code } : {}), ...(topic ? { topic } : {}),
});

const cards: Card[] = [
  // ---- data structures
  c("struct", "the tf.Tensor class", 1, ["is a multi-dimensional array with a single dtype for all elements", "is immutable once it has been created", "can be placed on a CPU, GPU or TPU"], "need an array object that TensorFlow can run on an accelerator", ["supports in-place item assignment such as t[0] = 5"], ["the tf.Variable class"]),
  c("struct", "the tf.Variable class", 1, ["holds mutable state such as model weights", "is changed with methods like assign and assign_add", "is watched automatically by a gradient tape"], "need a value that is updated during training", ["is immutable once created, like a constant"], ["the tf.Tensor class", "the tf.constant function"]),
  c("struct", "the tf.constant function", 1, ["builds an immutable tensor from a Python value or NumPy array", "infers the dtype from the data when none is given"], undefined, undefined, ["the tf.Tensor class", "the tf.Variable class"]),
  c("struct", "the RaggedTensor class", 3, ["stores rows whose lengths differ", "is created with tf.ragged.constant", "suits batches of variable-length sequences such as sentences"], "have a batch of sentences with different numbers of tokens and do not want to pad them", ["requires every row to have the same length"], ["the SparseTensor class"]),
  c("struct", "the SparseTensor class", 4, ["stores only non-zero values together with their indices", "is built from indices, values and a dense_shape"], "have a huge mostly-zero matrix and want to avoid storing the zeros", undefined, ["the RaggedTensor class"]),
  c("struct", "the tf.Module class", 4, ["is a base class that automatically tracks the variables and submodules assigned to it", "exposes trainable_variables for the objects it contains", "can be saved as a SavedModel when its methods are tf.functions"], "want a lightweight stateful container without the full Keras Model API"),

  // ---- tensor concepts
  c("tconcept", "tensor rank", 1, ["is the number of dimensions of a tensor", "is 0 for a scalar and 2 for a matrix", "is returned by tf.rank"], undefined, ["is the number of elements in the tensor"], ["tensor shape"]),
  c("tconcept", "tensor shape", 1, ["lists the size of every dimension", "is read from the shape attribute of a tensor", "may contain None for a dimension that is unknown statically"], "need to know how many rows, columns and channels a tensor has", ["is the same as the dtype"], ["tensor rank"]),
  c("tconcept", "tensor dtype", 1, ["fixes the numeric type of every element, such as float32 or int64", "is not promoted automatically between operands in TensorFlow ops", "is changed with tf.cast"], "get an error adding an integer tensor to a float tensor", ["is chosen per element, so one tensor can mix types"]),
  c("tconcept", "the batch dimension", 2, ["is conventionally the first axis of a tensor", "lets one call process many examples at once", "is usually None in a Keras model summary"], "see None as the first value in an output shape", ["must always be 1 during training"]),
  c("tconcept", "broadcasting", 2, ["stretches dimensions of size 1 to match another tensor", "aligns shapes starting from the trailing dimension", "lets a vector be added to every row of a matrix"], "add a bias vector to every row of a matrix without a loop", ["requires both tensors to have identical shapes"]),
  c("tconcept", "an axis", 2, ["is the index of a dimension that an operation acts along", "can be negative to count from the last dimension", "is given as the axis argument of reductions such as tf.reduce_sum"], undefined, undefined, ["tensor rank"]),
  c("tconcept", "device placement", 3, ["decides whether an op runs on the CPU, a GPU or a TPU", "is done automatically by TensorFlow when a GPU is available", "can be overridden inside a tf.device block"], "need to pin a specific operation to the CPU"),

  // ---- tensor operations
  c("op", "the tf.reshape function", 2, ["changes the shape of a tensor without changing element order", "accepts -1 for one dimension to be inferred", "needs the new shape to contain the same number of elements"], "need to flatten images to vectors before a dense layer by hand", ["changes the values stored in the tensor"], ["tf.transpose"]),
  c("op", "the tf.cast function", 2, ["converts a tensor to another dtype", "is needed to combine integer and float tensors"], "need to turn an int32 tensor into float32", undefined, ["the tf.reshape function"]),
  c("op", "the tf.concat function", 2, ["joins tensors along an existing axis", "does not add a new dimension"], "glue two batches together into one longer batch", ["adds a new leading dimension to the result"], ["the tf.stack function"]),
  c("op", "the tf.stack function", 3, ["joins tensors along a brand-new axis", "requires all input tensors to have the same shape", "increases the rank of the result by one"], "combine several equal-shape tensors into a single higher-rank tensor", undefined, ["the tf.concat function"]),
  c("op", "the tf.matmul function", 2, ["multiplies two matrices", "is also available through the @ operator", "supports batched matrix multiplication on higher-rank tensors"], undefined, ["multiplies two tensors element by element"], ["tf.einsum"]),
  c("op", "the tf.expand_dims function", 2, ["inserts a size-1 dimension at a chosen axis", "is a common way to add a batch dimension to a single example"], "have a single image of shape (28, 28) and the model needs a batch axis", undefined, ["the tf.squeeze function"]),
  c("op", "the tf.squeeze function", 3, ["removes dimensions of size 1", "can be limited to specific axes with the axis argument"], undefined, undefined, ["the tf.expand_dims function"]),
  c("op", "the tf.argmax function", 2, ["returns the index of the largest value along an axis", "turns a row of class scores into a predicted class id"], "need the predicted class from softmax outputs", ["returns the largest value itself"]),
  c("op", "the tf.reduce_mean function", 2, ["averages values over all elements or over a chosen axis", "drops the reduced axis unless keepdims is true"], undefined, undefined, ["tf.reduce_sum"]),

  // ---- execution
  c("exec", "eager execution", 1, ["runs operations immediately and returns concrete values", "is the default mode in TensorFlow 2", "lets you print tensors and use a debugger line by line"], "want to inspect tensor values while experimenting", ["builds a graph that must be run in a session"]),
  c("exec", "the tf.function decorator", 3, ["traces Python code into a TensorFlow graph", "can speed up repeated calls through graph optimisations", "retraces when it sees a new input signature or new Python argument values"], "want a Python function compiled into a reusable graph", ["forces the function to run line by line in Python"], ["AutoGraph"]),
  c("exec", "AutoGraph", 5, ["rewrites Python if and for statements into graph operations", "runs automatically on code inside a tf.function"], undefined, undefined, ["the tf.function decorator"]),
  c("exec", "retracing", 4, ["happens when a tf.function is called with a new dtype, shape or Python value", "is slow when it happens on every call", "can be reduced with an input_signature or by passing tensors instead of Python numbers"], "see a tf.function recompiling again and again in a loop", undefined, ["the tf.function decorator"]),
  c("exec", "the tf.print function", 4, ["prints values on every call inside a graph function", "is needed because Python print runs only while tracing"], "want to log a tensor value on every call of a tf.function", ["runs only during the first trace of a function"]),
  c("exec", "the input_signature argument", 4, ["fixes the dtypes and shapes a tf.function accepts", "prevents retracing for compatible inputs", "is written with tf.TensorSpec objects"], "export a function to a SavedModel with a known input type", undefined, ["the tf.function decorator"]),

  // ---- tf.data
  c("data", "the from_tensor_slices method", 1, ["builds a dataset by slicing tensors along their first dimension", "pairs features and labels when given a tuple"], "have NumPy arrays of features and labels in memory", ["reads records from TFRecord files"]),
  c("data", "the map method", 2, ["applies a function to every element of a dataset", "accepts num_parallel_calls to preprocess elements in parallel", "is where decoding and resizing are usually done"], "need to decode and resize every image", ["groups elements into batches"]),
  c("data", "the batch method", 1, ["combines consecutive elements into batches", "leaves a smaller final batch unless drop_remainder is true"], "feed the model 32 examples at a time", undefined, ["Dataset.padded_batch"]),
  c("data", "the shuffle method", 2, ["randomly reorders elements using a buffer of buffer_size items", "gives a better shuffle with a larger buffer", "is normally called before batch for training data"], "training data is stored in class order on disk", ["batches elements without changing their order"]),
  c("data", "the prefetch method", 2, ["prepares upcoming batches while the current step is running", "overlaps preprocessing with training", "is usually the last step in an input pipeline"], "the GPU sits idle waiting for the input pipeline", ["caches the dataset after the first epoch"], ["the cache method"]),
  c("data", "the cache method", 3, ["stores elements in memory or in a file after the first pass", "skips repeated work such as decoding on later epochs", "belongs before random augmentation, not after it"], "the same file decoding is repeated every epoch", ["overlaps preprocessing with training"], ["the prefetch method"]),
  c("data", "the take method", 2, ["returns a dataset with only the first n elements", "is handy for peeking at a few elements while debugging"], "want to look at the first few examples of a pipeline", undefined, ["Dataset.repeat"]),
  c("data", "the tf.data.AUTOTUNE constant", 3, ["lets tf.data choose parallelism or buffer sizes at runtime", "is passed to num_parallel_calls and prefetch"], undefined, ["is a fixed buffer size of 1024"]),
  c("data", "TFRecord", 3, ["is a binary file format of serialised records", "is read with tf.data.TFRecordDataset", "usually stores tf.train.Example messages"], "have a very large dataset that should stream from disk efficiently"),

  // ---- model building
  c("build", "Sequential model", 1, ["stacks layers in a plain linear list", "has exactly one input tensor and one output tensor", "is the simplest way to define a Keras model"], "build a simple stack of layers with one input and one output", ["supports models with multiple inputs"], ["Functional API"]),
  c("build", "Functional API", 2, ["builds a model as a graph of layers by calling layers on tensors", "supports multiple inputs, multiple outputs and shared layers", "ends with keras.Model(inputs, outputs)"], "need a model with two inputs or a skip connection", ["only allows a single linear stack of layers"], ["Sequential model"]),
  c("build", "model subclassing", 3, ["defines a model as a class with __init__ and call methods", "allows arbitrary Python control flow in the forward pass", "gives the most flexibility but weaker static checking"], "need dynamic Python logic in the forward pass", ["gives a fully inspectable layer graph before the model is called"], ["Functional API"]),
  c("build", "the keras.Input function", 2, ["declares the shape and dtype of a model input", "excludes the batch dimension from the shape argument", "returns a symbolic tensor for the Functional API"], undefined, ["includes the batch size in its shape argument"]),
  c("build", "a custom Layer", 3, ["subclasses keras.layers.Layer and implements call", "may create weights in build or __init__", "is reused like any built-in layer"], "need a reusable computation with its own weights"),
  c("build", "the summary method", 1, ["prints each layer with its output shape and parameter count", "reports trainable and non-trainable parameter totals"], "want to check how many parameters a model has"),

  // ---- layers
  c("layer", "Dense", 1, ["connects every input unit to every output unit", "computes activation(inputs @ kernel + bias)", "has input_dim * units + units parameters when it uses a bias"], "need a fully connected layer", ["slides a small kernel across the input"], ["Conv2D"]),
  c("layer", "Conv2D", 2, ["slides learnable kernels over height and width of an image", "shares the same weights at every spatial position", "uses padding valid by default, which shrinks the output"], "extract local visual patterns from images", ["connects each pixel to every output unit independently"], ["Dense"]),
  c("layer", "MaxPooling2D", 2, ["keeps the maximum value in each window", "reduces height and width without learnable weights"], "downsample feature maps cheaply", ["has trainable kernels like Conv2D"], ["GlobalAveragePooling2D"]),
  c("layer", "Flatten", 1, ["reshapes each example into a one-dimensional vector", "keeps the batch dimension untouched", "has no trainable parameters"], "turn convolution output into a vector for a Dense layer", undefined, ["GlobalAveragePooling2D"]),
  c("layer", "GlobalAveragePooling2D", 3, ["averages each feature map down to a single number", "turns (batch, h, w, channels) into (batch, channels)", "is a common head after a pretrained convolutional base"], "need a compact feature vector regardless of image size", undefined, ["Flatten"]),
  c("layer", "Dropout layer", 2, ["randomly zeroes a fraction of inputs during training", "scales surviving values so the expected sum stays the same", "does nothing at inference time"], "network overfits the training set", ["keeps dropping units during predict"], ["BatchNormalization"]),
  c("layer", "BatchNormalization", 3, ["normalises activations using batch statistics during training", "keeps moving averages of mean and variance for inference", "has learnable scale and offset parameters"], "deep network trains slowly or unstably", ["uses the same statistics in training and inference"], ["LayerNormalization"]),
  c("layer", "LayerNormalization", 4, ["normalises across the features of each example", "does not depend on batch size", "is standard inside transformer blocks"], "normalise sequence activations with very small batches", undefined, ["BatchNormalization"]),
  c("layer", "Embedding", 2, ["maps integer ids to learned dense vectors", "has input_dim * output_dim trainable parameters", "turns (batch, seq_len) into (batch, seq_len, output_dim)"], "feed token ids into a text model", ["expects one-hot vectors as input"]),
  c("layer", "LSTM", 3, ["processes sequences step by step with gated memory", "returns only the last output unless return_sequences is true", "helps with long-range dependencies better than a plain RNN"], "model a time series with a recurrent layer", undefined, ["GRU"]),
  c("layer", "GRU", 3, ["is a gated recurrent layer with fewer gates than an LSTM", "has no separate cell state", "usually has fewer parameters than an LSTM of equal size"], undefined, undefined, ["LSTM"]),
  c("layer", "MultiHeadAttention", 4, ["computes several attention operations in parallel and merges them", "takes query, value and optional key inputs", "is the core building block of transformer layers"], "let every position in a sequence attend to every other"),
  c("layer", "Rescaling", 2, ["multiplies inputs by a scale and adds an offset", "is often used as Rescaling(1./255) on image pixels", "is part of the model, so scaling travels with it"], "scale pixels from 0-255 inside the model itself"),

  // ---- model methods
  c("method", "the compile method", 1, ["configures the optimizer, loss and metrics", "must be called before fit or evaluate", "does not train the model"], "set the loss and optimizer before training", ["starts training for one epoch"], ["the fit method"]),
  c("method", "the fit method", 1, ["trains the model for a number of epochs", "returns a History object with per-epoch values", "accepts validation_data to monitor generalisation"], "start training on data", ["only computes metrics without updating weights"], ["the evaluate method"]),
  c("method", "the evaluate method", 1, ["computes loss and metrics on given data", "does not update weights", "returns a scalar or a list depending on the metrics compiled"], "measure test-set performance after training", ["returns predicted class probabilities"], ["the predict method"]),
  c("method", "the predict method", 1, ["returns the model outputs for input data", "processes the data in batches", "needs no labels"], "get outputs for new data", ["returns the loss and accuracy"], ["the evaluate method"]),
  c("method", "the save_weights method", 3, ["stores only the weights, not the architecture", "is paired with load_weights on a model of the same structure"], "keep a checkpoint of parameters while the architecture is defined in code"),
  c("method", "the train_on_batch method", 4, ["runs a single gradient update on one batch", "gives manual control without a full fit loop"], "need to drive training from your own loop one batch at a time"),
  c("method", "the save method", 2, ["writes the architecture, weights and compile config", "uses a .keras file for the native format", "can be undone by keras.models.load_model"], "ship a whole trained model as one file", ["stores only the weights"], ["the save_weights method"]),

  // ---- callbacks
  c("cb", "EarlyStopping", 2, ["stops training when a monitored metric stops improving", "waits for patience epochs before stopping", "can restore the best weights with restore_best_weights"], "validation loss starts rising while training loss keeps falling", ["saves a checkpoint file every epoch"]),
  c("cb", "ModelCheckpoint", 2, ["saves the model or weights during training", "keeps only the best result when save_best_only is true"], "keep the best epoch's model on disk", ["halts training when loss stalls"], ["EarlyStopping"]),
  c("cb", "ReduceLROnPlateau", 3, ["multiplies the learning rate by a factor when a metric stalls", "uses factor, patience and min_lr arguments"], "validation loss plateaus and a smaller step might help", undefined, ["LearningRateScheduler"]),
  c("cb", "LearningRateScheduler", 3, ["sets the learning rate from a function of the epoch", "runs the schedule function at the start of each epoch"], "follow a hand-written per-epoch learning-rate rule", undefined, ["ReduceLROnPlateau"]),
  c("cb", "TensorBoard callback", 2, ["writes logs that the TensorBoard UI can plot", "takes a log_dir where event files are stored"], "want to view loss curves in a browser dashboard"),
  c("cb", "CSVLogger", 3, ["streams epoch results into a CSV file", "gives a plain-text training history after the run"], "want per-epoch metrics saved as a spreadsheet-friendly file"),
  c("cb", "TerminateOnNaN", 4, ["ends training as soon as the loss becomes NaN", "needs no arguments"], "unstable training sometimes diverges to NaN and wastes time"),
  c("cb", "LambdaCallback", 4, ["builds a callback from plain functions for events like on_epoch_end", "avoids writing a full Callback subclass"], "need a quick one-off hook at the end of each epoch", undefined, ["custom Callback subclass"]),
  c("cb", "custom Callback subclass", 4, ["overrides hooks such as on_epoch_end or on_batch_begin", "receives logs with the current metric values", "can reach the model through self.model"], "need reusable logic that runs at many points in training", undefined, ["LambdaCallback"]),
  c("cb", "BackupAndRestore", 5, ["saves training state so an interrupted fit can resume", "restores the last completed epoch on restart"], "long jobs on preemptible machines may be killed mid-run"),

  // ---- losses
  c("loss", "SparseCategoricalCrossentropy", 1, ["expects integer class ids as labels", "pairs with a softmax or logits output over classes"], "classify into 10 classes with labels like 0 to 9", ["expects one-hot encoded labels"], ["CategoricalCrossentropy"]),
  c("loss", "CategoricalCrossentropy", 2, ["expects one-hot or soft label vectors", "supports label_smoothing on probability targets"], "labels are already one-hot vectors", ["expects integer class ids"], ["SparseCategoricalCrossentropy"]),
  c("loss", "BinaryCrossentropy", 1, ["is used for two-class or multi-label sigmoid outputs", "compares each output with a 0 or 1 target independently"], "predict spam or not spam with a single sigmoid unit", undefined, ["CategoricalCrossentropy"]),
  c("loss", "MeanSquaredError", 1, ["averages the squared difference between predictions and targets", "punishes large errors much more than small ones"], "regress a continuous value and large mistakes matter a lot", ["averages absolute differences"], ["MeanAbsoluteError"]),
  c("loss", "MeanAbsoluteError", 2, ["averages the absolute difference between predictions and targets", "is less sensitive to outliers than squared error"], "regress a value whose data contains outliers", undefined, ["MeanSquaredError", "Huber"]),
  c("loss", "Huber", 3, ["behaves like squared error for small errors and like absolute error for large ones", "has a delta threshold that sets where behaviour switches"], "want smooth near zero but robust to outliers", undefined, ["MeanAbsoluteError"]),
  c("loss", "the from_logits=True setting", 3, ["tells a cross-entropy loss that the model outputs raw scores", "lets the loss apply softmax or sigmoid internally in a numerically stable way"], "the last Dense layer has no softmax activation", ["must be set when the output layer already applies softmax"]),

  // ---- metrics
  c("metric", "SparseCategoricalAccuracy", 2, ["compares argmax predictions with integer labels", "is the metric partner of integer-label classification"], undefined, undefined, ["CategoricalAccuracy"]),
  c("metric", "CategoricalAccuracy", 2, ["compares argmax predictions with one-hot labels"], undefined, undefined, ["SparseCategoricalAccuracy"]),
  c("metric", "BinaryAccuracy", 2, ["thresholds sigmoid outputs, 0.5 by default, then counts matches"], undefined, undefined, ["CategoricalAccuracy"]),
  c("metric", "keras AUC metric", 3, ["measures the area under a ROC or PR curve", "is estimated from thresholds, so num_thresholds matters", "is useful when classes are imbalanced"], "accuracy hides poor performance on a rare positive class", undefined, ["Precision metric"]),
  c("metric", "Precision metric", 3, ["is true positives over predicted positives", "falls when the model makes many false alarms"], "false positives are costly", undefined, ["Recall metric"]),
  c("metric", "Recall metric", 3, ["is true positives over actual positives", "falls when the model misses real positives"], "missing a real positive is costly", undefined, ["Precision metric"]),
  c("metric", "RootMeanSquaredError", 3, ["is the square root of the mean squared error", "is expressed in the same units as the target"], "report a regression error in the target's own units", undefined, ["MeanSquaredError"]),

  // ---- optimizers
  c("opt", "SGD", 1, ["updates weights by a step against the gradient scaled by the learning rate", "can add momentum through its momentum argument", "is the classic baseline optimizer"], undefined, ["keeps a separate adaptive rate for every weight"], ["Adam"]),
  c("opt", "Adam", 1, ["keeps moving averages of gradients and squared gradients", "adapts the step size per parameter", "is a common default choice"], "want a sensible optimizer with little tuning", ["is plain gradient descent with no per-parameter state"], ["SGD", "AdamW"]),
  c("opt", "AdamW", 4, ["applies weight decay separately from the gradient update", "is Adam with decoupled weight decay"], "want Adam but with proper weight decay regularisation", undefined, ["Adam"]),
  c("opt", "RMSprop", 3, ["divides the step by a moving average of squared gradients", "was designed to keep step sizes stable per parameter"], undefined, undefined, ["Adagrad"]),
  c("opt", "Adagrad", 4, ["accumulates all past squared gradients to scale each step", "shrinks the effective learning rate over time"], "sparse features where rarely updated weights need larger steps", undefined, ["RMSprop"]),
  c("opt", "ExponentialDecay", 3, ["multiplies the learning rate by decay_rate every decay_steps steps", "is passed to an optimizer in place of a fixed learning rate"], "want the learning rate to shrink smoothly during training", undefined, ["CosineDecay"]),
  c("opt", "CosineDecay", 4, ["lowers the learning rate along a cosine curve", "ends near zero at decay_steps"], undefined, undefined, ["ExponentialDecay"]),
  c("opt", "the clipnorm argument", 4, ["limits the norm of each gradient tensor", "is an optimizer argument against exploding gradients"], "gradients occasionally spike and wreck training", undefined, ["the global_clipnorm argument"]),
  c("opt", "the global_clipnorm argument", 5, ["rescales all gradients together when their joint norm is too large", "preserves the relative direction across variables"], undefined, undefined, ["the clipnorm argument"]),

  // ---- autodiff
  c("diff", "the tf.GradientTape context", 2, ["records operations so gradients can be computed afterwards", "watches trainable tf.Variable objects automatically", "is the basis of custom training loops"], "need gradients of a loss for a hand-written training step", ["trains a model for several epochs"]),
  c("diff", "the tape.gradient method", 2, ["returns the derivative of a target with respect to sources", "returns None when the target does not depend on a source", "can be called only once on a non-persistent tape"], undefined, undefined, ["the apply_gradients method"]),
  c("diff", "the apply_gradients method", 2, ["updates variables from a list of gradient and variable pairs", "is fed with zip(grads, variables)"], "have computed gradients and now want to change the weights", undefined, ["the tape.gradient method"]),
  c("diff", "persistent tape", 4, ["allows gradient to be called more than once", "should be deleted when no longer needed to free memory"], "need two different gradients from one forward pass", undefined, ["the tape.gradient method"]),
  c("diff", "the tape.watch method", 3, ["tells the tape to track a tensor that is not a variable", "is required to differentiate with respect to a constant"], "need the gradient with respect to an input tensor"),
  c("diff", "the tf.stop_gradient function", 4, ["treats a tensor as a constant in the backward pass", "blocks gradients from flowing through that value"], "want part of an expression excluded from differentiation"),
  c("diff", "overriding train_step", 4, ["customises what fit does for each batch in a Model subclass", "lets fit keep callbacks and progress bars"], "want custom gradient logic but still use fit", undefined, ["the tf.GradientTape context"]),

  // ---- deployment
  c("deploy", "SavedModel", 2, ["is TensorFlow's language-neutral serialisation format", "stores the graph, weights and serving signatures", "is a directory rather than a single file"], "need to serve a model or load it without the original Python code", ["is a single .h5 file"], ["Keras file"]),
  c("deploy", "Keras file", 2, ["is the native saved format with a .keras extension", "stores the architecture, weights and optimizer state"], "save and reload a Keras model in Python", undefined, ["SavedModel"]),
  c("deploy", "TensorFlow Lite", 2, ["runs models on mobile and embedded devices", "uses a compact flatbuffer file with a .tflite extension", "is produced by a converter from a Keras model or SavedModel"], "deploy to a phone or microcontroller", ["serves models over a REST API"]),
  c("deploy", "TensorFlow Serving", 3, ["is a server that exposes SavedModels over REST and gRPC", "watches a base path for numbered version folders", "supports serving new model versions without code changes"], "put a trained model behind a production API", undefined, ["TensorFlow Lite"]),
  c("deploy", "TensorFlow.js", 3, ["runs models in the browser or Node.js", "loads converted models in JavaScript"], "run inference client-side in a web page"),
  c("deploy", "serving signature", 4, ["names the input and output tensors a SavedModel exposes", "defaults to the name serving_default", "can be inspected with saved_model_cli show"], "need to know what tensor names a saved model accepts"),
  c("deploy", "post-training quantization", 4, ["converts weights to lower precision such as 8-bit integers", "shrinks the model and can speed up CPU inference", "may cost a small amount of accuracy"], "TFLite model is too big for the device", ["retrains the model from scratch with fewer layers"]),
  c("deploy", "the tf.train.Checkpoint class", 4, ["saves and restores the values of tracked objects such as variables", "is how custom loops store model and optimizer state"], "need to save state from a custom training loop"),
  c("deploy", "the TFLiteConverter class", 3, ["turns a Keras model or SavedModel into a TFLite flatbuffer", "returns bytes from its convert method", "has an optimizations list for quantization"], "need to produce a .tflite file"),

  // ---- hardware & scaling
  c("hw", "MirroredStrategy", 3, ["replicates the model on each GPU of one machine", "averages gradients across replicas each step", "requires building and compiling the model inside strategy.scope()"], "train on several GPUs in a single machine", ["spreads training over many machines"], ["MultiWorkerMirroredStrategy"]),
  c("hw", "MultiWorkerMirroredStrategy", 4, ["extends synchronous data parallelism across several machines", "reads cluster layout from the TF_CONFIG environment variable"], "train on a cluster of machines", undefined, ["MirroredStrategy"]),
  c("hw", "TPUStrategy", 3, ["runs training on Cloud TPU hardware", "needs a TPU cluster resolver to connect to the TPU"], "have access to TPUs and want data-parallel training"),
  c("hw", "mixed precision", 3, ["computes in float16 or bfloat16 while keeping variables in float32", "can speed up training on supported accelerators", "is enabled with a global dtype policy"], "want faster training and lower memory use on a modern GPU", ["stores all weights in float16"]),
  c("hw", "loss scaling", 5, ["multiplies the loss to avoid float16 gradient underflow", "is applied automatically by Keras under the mixed_float16 policy"], "tiny float16 gradients are rounding to zero", undefined, ["mixed precision"]),
  c("hw", "memory growth", 3, ["makes TensorFlow allocate GPU memory only as needed", "is set with tf.config.experimental.set_memory_growth"], "TensorFlow grabs all GPU memory and starves other processes", undefined, ["mixed precision"]),
  c("hw", "XLA", 5, ["compiles groups of operations into fused kernels", "is switched on for a function with jit_compile=True"], "want operation fusion to cut memory traffic"),
  c("hw", "the global batch size", 4, ["is the per-replica batch size times the number of replicas", "is the batch size passed to the dataset under a distribution strategy"], "scale up from 1 GPU to 8 and want the same examples per step per GPU"),

  // ---- regularisation & transfer
  c("reg", "L2 regularizer", 2, ["adds the sum of squared weights times a factor to the loss", "pulls weights toward zero without making them exactly zero", "is attached with kernel_regularizer"], "want to keep weights small", ["drives many weights exactly to zero"], ["L1 regularizer"]),
  c("reg", "L1 regularizer", 3, ["adds the sum of absolute weights times a factor to the loss", "tends to produce sparse weights with many zeros"], "want a sparse model", undefined, ["L2 regularizer"]),
  c("reg", "data augmentation", 2, ["creates varied training examples with random flips, crops or rotations", "reduces overfitting on small image datasets", "uses preprocessing layers that are only active during training"], "have a small image dataset that overfits quickly"),
  c("reg", "transfer learning", 2, ["reuses a network pretrained on a large dataset", "needs far less data than training from scratch", "keeps the pretrained features and adds a new head"], "have a small dataset and a related large pretrained model", ["requires the same final classes as the source task"], ["fine-tuning"]),
  c("reg", "feature extraction", 3, ["freezes the pretrained base and trains only the new head"], "dataset is tiny and the pretrained features are good enough", undefined, ["fine-tuning"]),
  c("reg", "fine-tuning", 3, ["unfreezes some pretrained layers and trains them with a low learning rate", "usually follows training the new head first"], "feature extraction has plateaued and you have a moderate amount of data", ["should use a high learning rate to adapt quickly"], ["feature extraction"]),
  c("reg", "the include_top=False argument", 3, ["loads a pretrained application model without its classification head", "lets you attach your own output layers"], "adapt a pretrained network to a different set of classes"),
  c("reg", "the trainable = False setting", 2, ["freezes a layer's weights so fit does not update them", "makes the weights count as non-trainable in the summary", "must be set before compile to be reliably honoured"], "keep pretrained weights fixed while training a new head", ["deletes the layer's weights"]),
  c("reg", "label smoothing", 4, ["softens one-hot targets so the correct class is slightly below 1", "is an argument of cross-entropy losses", "can reduce overconfident predictions"], "model becomes overconfident on training labels"),
  c("reg", "the class_weight argument", 3, ["scales the loss of examples by their class in fit", "takes a dict mapping class index to weight"], "one class is much rarer and errors on it should count more"),

  // ---- common errors
  c("err", "a shape mismatch error", 1, ["appears when a layer receives an input shape it did not expect", "is fixed by checking model.summary and the data's shape"], "see an incompatible shapes message in a Dense layer", undefined, ["a dtype mismatch error"]),
  c("err", "a dtype mismatch error", 2, ["appears when ops get tensors of different dtypes, such as int32 and float32", "is fixed with tf.cast or by converting the data"], "adding an int tensor to a float tensor fails", undefined, ["a shape mismatch error"]),
  c("err", "a NaN loss", 3, ["can come from too high a learning rate or exploding gradients", "can come from log of zero or bad input data", "is often cured by lowering the learning rate or clipping gradients"], "loss prints nan after a few batches"),
  c("err", "an out-of-memory error", 3, ["occurs when the model, activations and batch exceed accelerator memory", "is eased by a smaller batch size or mixed precision"], "training crashes with a resource exhausted message"),
  c("err", "a label encoding mismatch", 3, ["happens when integer labels meet a loss that expects one-hot labels", "is fixed by choosing the sparse loss or by one-hot encoding the labels"], "get a shape error between labels and predictions with categorical crossentropy"),
  c("err", "unscaled inputs", 2, ["can leave a network learning slowly or unstably", "are fixed by normalising features or by using a Rescaling layer"], "raw pixel values from 0 to 255 go straight into the model"),
  c("err", "a Python side effect in tf.function", 5, ["runs only during tracing, not on each call", "affects things like Python print and list append"], "a print statement inside a decorated function fires only once", undefined, ["retracing"]),
  c("err", "forgetting the training flag", 4, ["leaves Dropout or BatchNormalization in the wrong mode in a subclassed model", "is avoided by passing training through nested layer calls"], "outputs differ between fit and manual calls of a subclassed model"),
  c("err", "a stuck accuracy", 3, ["can follow from a learning rate that is far too high or low", "can follow from labels that were shuffled apart from the inputs"], "accuracy stays at chance level for all epochs"),
];

const qa: QA[] = [
  q(1, "What does this print?", "(2, 3)", ["(3, 2)", "(6,)", "(2, 3, 1)"], "The outer list has two rows, each with three numbers, so the shape is (2, 3).", `import tensorflow as tf
t = tf.constant([[1, 2, 3], [4, 5, 6]])
print(t.shape)`, "Tensors"),
  q(1, "What dtype does t have?", "float32", ["int32", "float64", "It has no fixed dtype"], "One float among the values makes TensorFlow infer float32, the default float dtype.", `t = tf.constant([1.0, 2, 3])
print(t.dtype)`, "Tensors"),
  q(2, "What happens when this runs?", "An error, because int32 and float32 tensors cannot be added without a cast", ["It returns [2.0, 4.0, 6.0]", "It returns [2, 4, 6] as int32", "It returns [2.0, 4.0, 6.0] after a warning"], "TensorFlow does not promote dtypes between tensors; use tf.cast first.", `a = tf.constant([1, 2, 3])
b = tf.constant([1.0, 2.0, 3.0])
print(a + b)`, "Tensors"),
  q(1, "What happens on the last line?", "TypeError, because tensors do not support item assignment", ["t becomes [5, 2, 3]", "It silently does nothing", "A new tensor is added to the graph and t is rebound"], "Tensors are immutable; use a tf.Variable or build a new tensor.", `t = tf.constant([1, 2, 3])
t[0] = 5`, "Tensors"),
  q(2, "What does v.numpy() print?", "5.0", ["3.0", "2.0", "A new tf.Variable object"], "assign_add mutates the variable in place from 3.0 to 5.0.", `v = tf.Variable(3.0)
v.assign_add(2.0)
print(v.numpy())`, "Variables"),
  q(2, "What is the shape of the result?", "(3, 4)", ["(4, 3)", "(12,)", "(1, 12)"], "-1 is inferred so that 12 elements fit into 3 rows, giving 4 columns.", `x = tf.reshape(tf.range(12), [3, -1])
print(x.shape)`, "Tensors"),
  q(2, "What is the shape of a + b?", "(3, 4)", ["(3, 1)", "(1, 4)", "It raises an error because the shapes differ"], "Size-1 dimensions broadcast, so (3, 1) and (1, 4) give (3, 4).", `a = tf.ones([3, 1])
b = tf.ones([1, 4])
print((a + b).shape)`, "Tensors"),
  q(3, "What are the shapes of c and s?", "c is (4, 3) and s is (2, 2, 3)", ["c is (2, 6) and s is (4, 3)", "c is (4, 3) and s is (4, 3)", "c is (2, 2, 3) and s is (4, 3)"], "concat grows an existing axis; stack adds a new one.", `a = tf.zeros([2, 3])
b = tf.ones([2, 3])
c = tf.concat([a, b], axis=0)
s = tf.stack([a, b], axis=0)`, "Tensors"),
  q(2, "What does the print show?", "6.0", ["9.0", "3.0", "None"], "The derivative of x squared at x = 3 is 2x = 6.", `x = tf.Variable(3.0)
with tf.GradientTape() as tape:
    y = x ** 2
print(tape.gradient(y, x).numpy())`, "Autodiff"),
  q(3, "What does tape.gradient return here?", "None, because a constant is not watched by default", ["6.0", "0.0", "It raises a ValueError"], "Only trainable variables are watched automatically; use tape.watch(x) for constants.", `x = tf.constant(3.0)
with tf.GradientTape() as tape:
    y = x ** 2
print(tape.gradient(y, x))`, "Autodiff"),
  q(3, "What happens on the second gradient call?", "RuntimeError, because a non-persistent tape is released after one use", ["Both calls return the same value", "The second call returns None", "It returns the sum of both gradients"], "Create the tape with persistent=True to call gradient more than once.", `x = tf.Variable(2.0)
with tf.GradientTape() as tape:
    y = x * x
    z = y * y
g1 = tape.gradient(y, x)
g2 = tape.gradient(z, x)`, "Autodiff"),
  q(2, "What does this produce?", "[array([1, 2]), array([3, 4]), array([5])]", ["[array([1, 2]), array([3, 4])]", "[array([1, 2, 3, 4, 5])]", "[1, 2, 3, 4, 5]"], "The last batch is smaller because drop_remainder defaults to False.", `ds = tf.data.Dataset.from_tensor_slices([1, 2, 3, 4, 5]).batch(2)
print(list(ds.as_numpy_iterator()))`, "tf.data"),
  q(2, "What does the list contain?", "[0, 2]", ["[0, 1]", "[2, 4]", "[0, 2, 4, 6, 8]"], "map doubles each element, then take keeps the first two: 0 and 2.", `ds = tf.data.Dataset.range(5).map(lambda x: x * 2).take(2)
print(list(ds.as_numpy_iterator()))`, "tf.data"),
  q(3, "Which pipeline order is the usual choice for training data?", "ds.shuffle(1000).batch(32).prefetch(tf.data.AUTOTUNE)", ["ds.batch(32).shuffle(1000).prefetch(tf.data.AUTOTUNE)", "ds.prefetch(tf.data.AUTOTUNE).shuffle(1000).batch(32)", "ds.batch(32).prefetch(tf.data.AUTOTUNE).shuffle(1000)"], "Shuffle individual examples before batching, and prefetch last to overlap with training.", undefined, "tf.data"),
  q(3, "How many examples does the model see per epoch with this pipeline?", "Every example once, in batches of 64", ["Only 64 examples", "Only 10000 examples", "Infinite examples, so the epoch never ends"], "shuffle only sets a buffer for randomisation; it does not limit how many elements pass through.", `ds = ds.shuffle(10000).batch(64)
model.fit(ds, epochs=1)`, "tf.data"),
  q(3, "How many parameters does this model have?", "49", ["40", "41", "36"], "Dense(8): 4*8+8 = 40. Dense(1): 8*1+1 = 9. Total 49.", `model = tf.keras.Sequential([
    tf.keras.Input(shape=(4,)),
    tf.keras.layers.Dense(8),
    tf.keras.layers.Dense(1),
])
print(model.count_params())`, "Keras models"),
  q(3, "What is the output shape of this Conv2D layer on a batch?", "(None, 26, 26, 16)", ["(None, 28, 28, 16)", "(None, 26, 26, 1)", "(None, 13, 13, 16)"], "Valid padding with a 3x3 kernel shrinks 28 to 26, and 16 filters give 16 channels.", `x = tf.keras.Input(shape=(28, 28, 1))
y = tf.keras.layers.Conv2D(16, 3)(x)
print(y.shape)`, "Layers"),
  q(3, "How many parameters does this Conv2D layer have?", "160", ["144", "448", "16"], "16 filters of 3*3*1 weights is 144, plus 16 biases gives 160.", `layer = tf.keras.layers.Conv2D(16, 3)
layer.build((None, 28, 28, 1))
print(layer.count_params())`, "Layers"),
  q(3, "What is the output shape of the Flatten layer?", "(None, 3136)", ["(None, 64)", "(None, 7, 7, 64)", "(None, 448)"], "7 * 7 * 64 equals 3136 values per example.", `x = tf.keras.Input(shape=(7, 7, 64))
y = tf.keras.layers.Flatten()(x)
print(y.shape)`, "Layers"),
  q(3, "What is the output shape of this Embedding layer, and how many parameters does it have?", "(None, 20, 16) and 160000 parameters", ["(None, 16) and 160000 parameters", "(None, 20, 10000) and 160000 parameters", "(None, 20, 16) and 16 parameters"], "Each of 20 ids becomes a 16-vector, and the table is 10000 by 16.", `x = tf.keras.Input(shape=(20,), dtype="int32")
y = tf.keras.layers.Embedding(input_dim=10000, output_dim=16)(x)
print(y.shape)`, "Layers"),
  q(2, "Which loss goes with integer labels 0-9 and a softmax output?", "sparse_categorical_crossentropy", ["categorical_crossentropy", "binary_crossentropy", "mean_squared_error"], "Integer class ids need the sparse variant of categorical cross-entropy.", `model.add(tf.keras.layers.Dense(10, activation="softmax"))
model.compile(optimizer="adam", loss=...)`, "Compile and fit"),
  q(3, "The last layer has no activation. Which loss setup is correct?", "SparseCategoricalCrossentropy(from_logits=True)", ["SparseCategoricalCrossentropy(from_logits=False)", "BinaryCrossentropy(from_logits=False)", "MeanSquaredError(from_logits=True)"], "Raw scores are logits, so the loss must apply softmax itself.", `model.add(tf.keras.layers.Dense(10))
model.compile(optimizer="adam", loss=...)`, "Compile and fit"),
  q(3, "What happens if you use from_logits=False with an output layer that produces raw logits?", "The loss treats scores as probabilities and training behaves incorrectly", ["TensorFlow converts the scores automatically with no effect", "The model refuses to compile", "Only the metrics are affected, not the loss"], "The loss assumes values are probabilities in [0, 1] unless told otherwise.", undefined, "Compile and fit"),
  q(2, "Which rows does validation_split=0.2 use for validation?", "The last 20 percent of the arrays, taken before shuffling", ["A random 20 percent chosen each epoch", "The first 20 percent of the arrays", "Rows chosen by class to keep balance"], "Keras slices off the final fraction before any shuffle.", `model.fit(x, y, epochs=5, validation_split=0.2)`, "Compile and fit"),
  q(2, "What is history.history?", "A dict mapping metric names to lists with one value per epoch", ["The trained weights of the model", "A pandas DataFrame of predictions", "A list of the best epoch indices"], "It holds loss, metrics and their val_ versions per epoch.", `history = model.fit(x, y, epochs=10, validation_split=0.1)
print(history.history.keys())`, "Compile and fit"),
  q(3, "What does this callback do?", "Stops after 3 epochs without val_loss improvement and restores the best weights", ["Stops after exactly 3 epochs", "Saves the model every 3 epochs", "Reduces the learning rate after 3 epochs"], "patience counts epochs without improvement; restore_best_weights reloads the best weights.", `cb = tf.keras.callbacks.EarlyStopping(
    monitor="val_loss", patience=3, restore_best_weights=True)`, "Callbacks"),
  q(3, "What does this callback keep on disk?", "Only the model from the epoch with the lowest val_loss", ["The model from every epoch", "The model from the last epoch only", "Only the weights from the first epoch"], "save_best_only keeps the file overwritten only on improvement.", `cb = tf.keras.callbacks.ModelCheckpoint(
    "best.keras", monitor="val_loss", save_best_only=True)`, "Callbacks"),
  q(2, "Which line turns softmax outputs of shape (n, 10) into class ids?", "np.argmax(preds, axis=1)", ["np.max(preds, axis=0)", "preds.round()", "np.argmax(preds, axis=0)"], "argmax over axis 1 picks the best class for each row.", `preds = model.predict(x_test)
labels = ...`, "Compile and fit"),
  q(2, "What does evaluate return here?", "A list: the loss followed by the accuracy", ["Only the accuracy", "An array of predictions", "A History object"], "With one metric compiled, evaluate returns [loss, metric].", `model.compile(optimizer="adam", loss="mse", metrics=["mae"])
result = model.evaluate(x_test, y_test)`, "Compile and fit"),
  q(3, "Which line completes the custom training step?", "optimizer.apply_gradients(zip(grads, model.trainable_variables))", ["loss.backward()", "model.trainable_variables = grads", "optimizer.zero_grad()"], "apply_gradients takes gradient and variable pairs, the TensorFlow way to update weights.", `with tf.GradientTape() as tape:
    preds = model(x, training=True)
    loss = loss_fn(y, preds)
grads = tape.gradient(loss, model.trainable_variables)
# next line?`, "Autodiff"),
  q(3, "Why is the training argument passed down to the Dropout layer?", "So Dropout is active during training and inactive during inference", ["So Dropout can change the learning rate", "So the layer is frozen", "So the layer returns gradients"], "Layers like Dropout and BatchNormalization behave differently in training and inference.", `class Net(tf.keras.Model):
    def __init__(self):
        super().__init__()
        self.dense = tf.keras.layers.Dense(64, activation="relu")
        self.drop = tf.keras.layers.Dropout(0.5)
    def call(self, x, training=False):
        return self.drop(self.dense(x), training=training)`, "Keras models"),
  q(2, "Why can this model not be built with Sequential?", "It has two inputs", ["It uses a Dense layer", "It has an output layer", "It uses relu"], "Sequential supports exactly one input and one output; two inputs need the Functional API.", `a = tf.keras.Input(shape=(8,))
b = tf.keras.Input(shape=(4,))
x = tf.keras.layers.Concatenate()([a, b])
out = tf.keras.layers.Dense(1)(x)
model = tf.keras.Model([a, b], out)`, "Keras models"),
  q(3, "What does base.trainable = False do before compile?", "Fit no longer updates the weights of the base model", ["It deletes the base model's weights", "It makes the base model produce no output", "It trains the base model faster"], "Frozen layers keep their weights; only the new head trains.", `base = tf.keras.applications.MobileNetV2(include_top=False, weights="imagenet")
base.trainable = False`, "Transfer learning"),
  q(4, "Why call the frozen base with training=False?", "So BatchNormalization uses its stored statistics rather than batch statistics", ["So the base model runs on CPU", "So the output is cast to integers", "So gradients flow through the base"], "BatchNorm layers must stay in inference mode when fine-tuning a pretrained base.", `inputs = tf.keras.Input(shape=(160, 160, 3))
x = base(inputs, training=False)
x = tf.keras.layers.GlobalAveragePooling2D()(x)
outputs = tf.keras.layers.Dense(5)(x)`, "Transfer learning"),
  q(3, "What does converter.convert() return?", "The bytes of a TFLite flatbuffer, ready to write to a .tflite file", ["A Keras model object", "A SavedModel directory path", "A list of quantised layers"], "You write the returned bytes to disk yourself.", `converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()
open("model.tflite", "wb").write(tflite_model)`, "Deployment"),
  q(4, "What does setting converter.optimizations do?", "It applies dynamic-range quantization, shrinking the weights", ["It trains the model for more epochs", "It converts the model to JavaScript", "It prunes layers at random"], "Optimize.DEFAULT quantises weights, reducing size.", `converter.optimizations = [tf.lite.Optimize.DEFAULT]`, "Deployment"),
  q(3, "Which line reloads a SavedModel and calls its default signature?", "tf.saved_model.load('export/1').signatures['serving_default']", ["tf.keras.layers.load('export/1')", "tf.saved_model.save('export/1')", "tf.lite.load('export/1').signatures"], "tf.saved_model.load returns an object exposing signatures.", undefined, "Deployment"),
  q(3, "Which request does TensorFlow Serving's REST API expect?", "POST to /v1/models/my_model:predict with a JSON body containing instances", ["GET to /predict with a CSV file", "POST to /my_model/run with a pickled model", "PUT to /v1/models/my_model with a SavedModel"], "The REST predict endpoint takes a JSON body with an instances list.", undefined, "Deployment"),
  q(3, "What must model_base_path point to?", "A directory containing numbered version subdirectories of SavedModels", ["A single .h5 file", "A .tflite file", "A Python script that builds the model"], "Serving picks the highest numeric version folder.", `tensorflow_model_server --rest_api_port=8501 \\
  --model_name=my_model --model_base_path=/models/my_model`, "Deployment"),
  q(3, "What does this policy change?", "Layers compute in float16 while keeping their variables in float32", ["All weights are stored in float16", "Training is moved to the CPU", "The loss is replaced by a mean squared error"], "Mixed precision combines low-precision compute with full-precision variables.", `tf.keras.mixed_precision.set_global_policy("mixed_float16")`, "Hardware"),
  q(4, "Why give the final softmax layer dtype float32 under mixed precision?", "Float16 softmax outputs can lose precision and cause numeric problems", ["Softmax cannot run on a GPU", "Float16 cannot represent class ids", "It makes the optimizer faster"], "Keeping the output in float32 preserves numerical stability.", `x = tf.keras.layers.Dense(10)(x)
outputs = tf.keras.layers.Activation("softmax", dtype="float32")(x)`, "Hardware"),
  q(3, "Why is the model built inside strategy.scope()?", "So its variables are created as mirrored variables across the replicas", ["So it is saved automatically", "So it runs on CPU only", "So fit uses a larger learning rate"], "Variables must be created within the strategy scope to be distributed.", `strategy = tf.distribute.MirroredStrategy()
with strategy.scope():
    model = build_model()
    model.compile(optimizer="adam", loss="mse")`, "Hardware"),
  q(2, "What does this return on a machine with no GPU?", "An empty list", ["None", "A list with one CPU entry", "It raises RuntimeError"], "list_physical_devices returns the devices of the requested type, possibly none.", `print(tf.config.list_physical_devices("GPU"))`, "Hardware"),
  q(4, "What gets printed when f is called twice with scalar tensors?", "'tracing' once and 'running' twice", ["'tracing' twice and 'running' twice", "'tracing' once and 'running' once", "Neither is printed"], "Python print runs while tracing; tf.print runs each call of the graph.", `@tf.function
def f(x):
    print("tracing")
    tf.print("running")
    return x * 2

f(tf.constant(1)); f(tf.constant(2))`, "Execution"),
  q(3, "What does this layer do to the inputs?", "Scales pixel values from the range 0-255 to 0-1", ["Flips the images horizontally", "Converts images to grayscale", "Resizes images to 255 pixels"], "Rescaling multiplies inputs by the scale factor.", `tf.keras.layers.Rescaling(1.0 / 255)`, "Layers"),
  q(3, "What does m.result() return?", "2.0", ["6.0", "3.0", "1.0"], "Mean keeps a running average of everything passed to update_state.", `m = tf.keras.metrics.Mean()
m.update_state([1.0, 2.0, 3.0])
print(m.result().numpy())`, "Metrics"),
  q(4, "What learning rate does this schedule give at step 100?", "0.05", ["0.1", "0.5", "0.005"], "0.1 * 0.5^(100/100) = 0.05.", `lr = tf.keras.optimizers.schedules.ExponentialDecay(
    initial_learning_rate=0.1, decay_steps=100, decay_rate=0.5)
print(float(lr(100)))`, "Optimizers"),
  q(2, "Which call saves and reloads a whole Keras model in the native format?", "model.save('m.keras') then tf.keras.models.load_model('m.keras')", ["model.save_weights('m.keras') then model.fit('m.keras')", "tf.saved_model.load('m.keras') then model.save()", "model.compile('m.keras') then model.predict('m.keras')"], "save writes everything and load_model rebuilds it.", undefined, "Deployment"),
  q(4, "How does clipnorm differ from global_clipnorm?", "clipnorm clips each gradient tensor individually, global_clipnorm uses the joint norm of all gradients", ["clipnorm is applied to the loss and global_clipnorm to the weights", "clipnorm clips only biases", "They are two names for the same option"], "global_clipnorm preserves relative scale between gradients.", `tf.keras.optimizers.Adam(clipnorm=1.0)
tf.keras.optimizers.Adam(global_clipnorm=1.0)`, "Optimizers"),
  q(2, "Your labels are one-hot vectors. How do you convert integer labels y to that form?", "tf.one_hot(y, depth=num_classes)", ["tf.reshape(y, [-1])", "tf.cast(y, tf.float32)", "tf.argmax(y)"], "one_hot expands each integer into a vector of length depth.", undefined, "Compile and fit"),
  q(4, "A frozen BatchNormalization layer in TensorFlow 2 behaves how once trainable is False?", "It runs in inference mode, using its stored statistics", ["It keeps updating its statistics from each batch", "It is removed from the model", "It outputs zeros"], "Setting trainable=False on BatchNorm also switches it to inference mode.", undefined, "Transfer learning"),
  q(2, "What does tf.reduce_sum(x, axis=0) return?", "[4 6]", ["[3 7]", "10", "[[1 2] [3 4]]"], "Summing along axis 0 adds the rows: 1+3 and 2+4.", `x = tf.constant([[1, 2], [3, 4]])
print(tf.reduce_sum(x, axis=0).numpy())`, "Tensors"),
];

const spec: TrackSpec = {
  slug: "ml-tensorflow-titan",
  name: "TensorFlow and Keras: Novice to Titan",
  description: "Tensors, tf.data pipelines, Keras models and layers, training workflows, callbacks, losses, optimizers, GradientTape, export, serving, accelerators, transfer learning and common errors.",
  roles: "developer",
  groups: {
    struct: "TensorFlow data structure",
    tconcept: "tensor concept",
    op: "tensor operation",
    exec: "TensorFlow execution concept",
    data: "tf.data component",
    build: "Keras model-building concept",
    layer: "Keras layer",
    method: "Keras Model method",
    cb: "Keras callback",
    loss: "loss function concept",
    metric: "Keras metric",
    opt: "optimizer concept",
    diff: "automatic-differentiation tool",
    deploy: "export or deployment concept",
    hw: "hardware or scaling concept",
    reg: "regularisation or transfer-learning technique",
    err: "common training problem",
  },
  cards,
  qa,
  calc: [],
};
export default spec;
